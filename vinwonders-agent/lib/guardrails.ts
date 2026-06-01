/**
 * Security & Guardrails Module for TypeScript Agent
 *
 * Provides:
 * 1. Input validation & sanitization
 * 2. Prompt injection detection
 * 3. Tool validation (name + args)
 * 4. Output safety filtering
 * 5. Rate limiting
 * 6. Security event logging
 */

import { z } from 'zod';
import {
  containsDangerousFragments,
  removeActiveContent,
  sanitizeUserInput,
} from '@/lib/security/sanitization';
import { redactPii } from '@/lib/security/redaction';

interface SecurityEvent {
  level: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  details: Record<string, any>;
  timestamp: number;
}

interface RateLimitTracker {
  lastRequest: number;
  count: number;
}

export class GuardrailsValidator {
  private maxInputLength = 2000;
  private maxTokens = 4000;
  private maxSteps = 5;
  private maxConcurrentRequests = 10;

  // Rate limiting
  private userRateLimits = new Map<string, RateLimitTracker>();
  private ipRateLimits = new Map<string, RateLimitTracker>();
  private rateLimitWindow = 3600000; // 1 hour
  private userRequestsPerHour = 100;
  private ipRequestsPerHour = 500;

  private securityEvents: SecurityEvent[] = [];

  private injectionPatterns = [
    /ignore\s+(all\s+)?previous/i,
    /forget\s+(all\s+)?previous/i,
    /disregard\s+(all\s+)?previous/i,
    /override.*instruction/i,
    /system\s*prompt\s*:/i,
    /role[_-]?play\s+as/i,
    /you\s+are\s+now/i,
    /pretend\s+you're/i,
    /act\s+as\s+if/i,
    /new\s+rules?:/i,
    /new\s+instructions?:/i,
    /\[SYSTEM\]/i,
    /\{SYSTEM\}/i,
    /<!--.*?-->/i,
  ];

  private dangerousCodePatterns = [
    /import\s+os/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /__import__/i,
    /subprocess/i,
    /os\.system/i,
    /shell\s*=\s*true/i,
    /';?\s*DROP\s+TABLE/i,
    /';?\s*DELETE\s+FROM/i,
    /<script[^>]*>/i,
    /javascript:/i,
  ];

  private credentialPatterns = {
    password: /(?:password|passwd|pwd|mat\s*khau)['":\s=]+[^\s]{6,}/i,
  };

  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };
    this.securityEvents.push(fullEvent);

    // Keep last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SECURITY ${event.level.toUpperCase()}]`, event.message, event.details);
    }
  }

  // ==================== RATE LIMITING ====================

  checkRateLimit(userId: string, ipAddress: string): boolean {
    const now = Date.now();

    // Check user rate limit
    const userTracker = this.userRateLimits.get(userId);
    if (userTracker) {
      if (now - userTracker.lastRequest > this.rateLimitWindow) {
        // Reset
        userTracker.count = 1;
        userTracker.lastRequest = now;
      } else if (userTracker.count >= this.userRequestsPerHour) {
        this.logEvent({
          level: 'warning',
          category: 'rate_limit',
          message: `User rate limit exceeded (${userTracker.count}/${this.userRequestsPerHour}/hr)`,
          details: { userId },
        });
        return false;
      } else {
        userTracker.count++;
      }
    } else {
      this.userRateLimits.set(userId, { count: 1, lastRequest: now });
    }

    // Check IP rate limit
    const ipTracker = this.ipRateLimits.get(ipAddress);
    if (ipTracker) {
      if (now - ipTracker.lastRequest > this.rateLimitWindow) {
        // Reset
        ipTracker.count = 1;
        ipTracker.lastRequest = now;
      } else if (ipTracker.count >= this.ipRequestsPerHour) {
        this.logEvent({
          level: 'critical',
          category: 'rate_limit',
          message: `IP rate limit exceeded (${ipTracker.count}/${this.ipRequestsPerHour}/hr)`,
          details: { ipAddress },
        });
        return false;
      } else {
        ipTracker.count++;
      }
    } else {
      this.ipRateLimits.set(ipAddress, { count: 1, lastRequest: now });
    }

    return true;
  }

  // ==================== INPUT VALIDATION ====================

  validateInput(userInput: string, userId: string = 'unknown'): boolean {
    const sanitized = sanitizeUserInput(
      typeof userInput === 'string' ? userInput : '',
      this.maxInputLength,
    );

    if (!sanitized) {
      this.logEvent({
        level: 'warning',
        category: 'validation',
        message: 'Empty or invalid input type',
        details: { userId },
      });
      return false;
    }

    userInput = sanitized;

    // Check length
    if (userInput.length > this.maxInputLength) {
      this.logEvent({
        level: 'warning',
        category: 'validation',
        message: `Input exceeds max length (${userInput.length} > ${this.maxInputLength})`,
        details: { userId, inputLength: userInput.length },
      });
      return false;
    }

    // Check for null bytes
    if (userInput.includes('\x00')) {
      this.logEvent({
        level: 'warning',
        category: 'validation',
        message: 'Null bytes detected in input',
        details: { userId },
      });
      return false;
    }

    if (containsDangerousFragments(userInput)) {
      this.logEvent({
        level: 'critical',
        category: 'validation',
        message: 'Dangerous fragments detected in input',
        details: { userId },
      });
      return false;
    }

    // Check for prompt injection
    if (this.detectInjection(userInput)) {
      this.logEvent({
        level: 'critical',
        category: 'injection',
        message: 'Prompt injection attempt detected',
        details: { userId, inputHash: this.hashString(userInput) },
      });
      return false;
    }

    return true;
  }

  detectInjection(text: string): boolean {
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  // ==================== TOOL VALIDATION ====================

  validateTool(
    toolName: string,
    toolArgs: Record<string, any>,
    availableTools: string[] = [],
  ): { valid: boolean; error?: string } {
    // Validate tool name
    if (!toolName || typeof toolName !== 'string') {
      this.logEvent({
        level: 'warning',
        category: 'tool_access',
        message: 'Invalid tool name',
        details: { toolName },
      });
      return { valid: false, error: 'Invalid tool name' };
    }

    // Check against whitelist
    if (availableTools.length > 0 && !availableTools.includes(toolName)) {
      this.logEvent({
        level: 'critical',
        category: 'tool_access',
        message: `Tool '${toolName}' is not in whitelist`,
        details: { requestedTool: toolName, available: availableTools },
      });
      return { valid: false, error: `Tool '${toolName}' is not allowed` };
    }

    // Validate arguments
    const argString = JSON.stringify(toolArgs);
    if (!this.isSafeToolArgs(argString)) {
      this.logEvent({
        level: 'critical',
        category: 'tool_access',
        message: `Tool arguments contain dangerous patterns`,
        details: { toolName, argsHash: this.hashString(argString) },
      });
      return { valid: false, error: 'Dangerous patterns detected in arguments' };
    }

    return { valid: true };
  }

  private isSafeToolArgs(args: string): boolean {
    for (const pattern of this.dangerousCodePatterns) {
      if (pattern.test(args)) {
        return false;
      }
    }
    return true;
  }

  // ==================== OUTPUT SAFETY ====================

  sanitizeOutput(text: string): string {
    if (!text) return text;
    return redactPii(removeActiveContent(text));
  }

  validateOutput(text: string): boolean {
    for (const [patternName, pattern] of Object.entries(this.credentialPatterns)) {
      if (pattern.test(text)) {
        this.logEvent({
          level: 'critical',
          category: 'validation',
          message: `Sensitive data (${patternName}) detected in output`,
          details: { patternName },
        });
        return false;
      }
    }

    return true;
  }

  // ==================== RESOURCE LIMITS ====================

  trackResourceUsage(
    requestId: string,
    inputTokens: number,
    outputTokens: number,
    steps: number,
  ): boolean {
    const totalTokens = inputTokens + outputTokens;

    // Check token budget
    if (totalTokens > this.maxTokens) {
      this.logEvent({
        level: 'warning',
        category: 'resource',
        message: `Token budget exceeded (${totalTokens} > ${this.maxTokens})`,
        details: {
          requestId,
          inputTokens,
          outputTokens,
        },
      });
      return false;
    }

    // Check step limit
    if (steps > this.maxSteps) {
      this.logEvent({
        level: 'warning',
        category: 'resource',
        message: `Step limit exceeded (${steps} > ${this.maxSteps})`,
        details: { requestId, steps },
      });
      return false;
    }

    return true;
  }

  // ==================== HELPERS ====================

  private hashString(str: string): string {
    // Simple hash function (not cryptographic)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  // ==================== REPORTING ====================

  getSecurityReport(limit: number = 100): {
    totalEvents: number;
    critical: number;
    warning: number;
    info: number;
    events: Array<Omit<SecurityEvent, 'details'>>;
  } {
    const events = this.securityEvents.slice(-limit);

    const criticalCount = events.filter((e) => e.level === 'critical').length;
    const warningCount = events.filter((e) => e.level === 'warning').length;
    const infoCount = events.filter((e) => e.level === 'info').length;

    return {
      totalEvents: events.length,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      events: events.map((e) => ({
        level: e.level,
        category: e.category,
        message: e.message,
        timestamp: e.timestamp,
      })),
    };
  }
}

// Global validator instance
let globalValidator: GuardrailsValidator | null = null;

export function getValidator(): GuardrailsValidator {
  if (!globalValidator) {
    globalValidator = new GuardrailsValidator();
  }
  return globalValidator;
}
