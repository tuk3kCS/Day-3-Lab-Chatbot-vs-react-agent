/**
 * Input/output sanitization for chat API and structured logs.
 */

import { redactPii } from './redaction';

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const NULL_BYTES = /\x00/g;
const SCRIPT_TAG = /<script[^>]*>[\s\S]*?<\/script>/gi;
const IFRAME_TAG = /<iframe[^>]*>[\s\S]*?<\/iframe>/gi;
const JS_URI = /javascript\s*:/gi;

const DANGEROUS_FRAGMENTS = [
  /\.\.\//,
  /';?\s*DROP\s+TABLE/i,
  /';?\s*DELETE\s+FROM/i,
];

export function stripControlCharacters(text: string): string {
  return text.replace(NULL_BYTES, '').replace(CONTROL_CHARS, '');
}

export function removeActiveContent(text: string): string {
  return text
    .replace(SCRIPT_TAG, '')
    .replace(IFRAME_TAG, '')
    .replace(JS_URI, '');
}

export function containsDangerousFragments(text: string): boolean {
  return DANGEROUS_FRAGMENTS.some((p) => p.test(text));
}

export function sanitizeUserInput(text: string, maxLength = 2000): string {
  if (!text) return '';
  let cleaned = stripControlCharacters(text.trim());
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

export function sanitizeOutputText(text: string): string {
  return redactPii(removeActiveContent(text));
}

export function sanitizeForLogging(
  value: unknown,
  maxStrLen = 500,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean' || typeof value === 'number') return value;

  if (typeof value === 'string') {
    const truncated =
      value.length <= maxStrLen ? value : `${value.slice(0, maxStrLen)}…`;
    return redactPii(truncated);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogging(item, maxStrLen));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForLogging(v, maxStrLen);
    }
    return out;
  }

  return redactPii(String(value).slice(0, maxStrLen));
}

export function sanitizeToolOutputJson(output: unknown): string {
  const raw = typeof output === 'string' ? output : JSON.stringify(output);
  return sanitizeOutputText(raw);
}
