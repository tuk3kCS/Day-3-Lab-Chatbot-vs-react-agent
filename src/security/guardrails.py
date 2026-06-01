"""
Security & Guardrails Module for Python Agent

Provides:
1. Input validation & sanitization
2. Prompt injection detection
3. Tool validation (name + args)
4. Output safety filtering
5. Resource limits enforcement
6. Security event logging
"""

import re
import json
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import hashlib
import time

from src.telemetry.logger import logger


class SecurityLevel(Enum):
    """Security alert levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class SecurityEvent:
    """Represents a security event"""
    level: SecurityLevel
    category: str  # "injection", "validation", "resource", "tool_access"
    message: str
    details: Dict[str, Any]
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()


class GuardrailsValidator:
    """
    Main security validator for agent inputs, outputs, and tool execution.
    """

    def __init__(self, max_input_length: int = 2000, max_tokens: int = 4000):
        self.max_input_length = max_input_length
        self.max_tokens = max_tokens
        self.max_steps = 5
        self.max_tool_depth = 10

        # Patterns for prompt injection detection
        self.injection_patterns = [
            r"ignore\s+(all\s+)?previous",
            r"forget\s+(all\s+)?previous",
            r"disregard\s+(all\s+)?previous",
            r"override.*instruction",
            r"system\s*prompt\s*:",
            r"role[_-]?play\s+as",
            r"you\s+are\s+now",
            r"pretend\s+you're",
            r"act\s+as\s+if",
            r"new\s+rules?:",
            r"new\s+instructions?:",
            r"\[SYSTEM\]",
            r"\{SYSTEM\}",
            r"<!--.*?-->",  # HTML comments
        ]

        # Patterns for sensitive data
        self.sensitive_patterns = {
            "api_key": r"(?:api[_-]?key|apikey|secret)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}",
            "password": r"(?:password|passwd|pwd)['\"]?\s*[:=]\s*['\"]?[^\s]{6,}",
            "token": r"(?:token|bearer|auth)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}",
            "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "phone": r"\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b",
            "ssn": r"\b\d{3}-\d{2}-\d{4}\b",  # US SSN
            "credit_card": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
        }

        # Dangerous code patterns
        self.dangerous_code_patterns = [
            r"import\s+os",
            r"exec\s*\(",
            r"eval\s*\(",
            r"__import__",
            r"subprocess",
            r"os\.system",
            r"shell\s*=\s*True",
            r"';?\s*DROP\s+TABLE",
            r"';?\s*DELETE\s+FROM",
            r"<script[^>]*>",
            r"javascript:",
        ]

        # Resource tracking
        self.request_resources: Dict[str, Dict] = {}
        self.security_events: List[SecurityEvent] = []

    def log_event(self, event: SecurityEvent) -> None:
        """Log a security event"""
        self.security_events.append(event)
        logger.log_event(
            f"SECURITY_{event.level.value.upper()}",
            {
                "category": event.category,
                "message": event.message,
                "details": event.details,
            },
        )

    # ==================== INPUT VALIDATION ====================

    def validate_input(self, user_input: str, user_id: str = "unknown") -> bool:
        """
        Validate user input for security issues.
        
        Returns:
            bool: True if input is safe, False otherwise
        """
        if not user_input or not isinstance(user_input, str):
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="validation",
                    message="Empty or invalid input type",
                    details={"user_id": user_id},
                )
            )
            return False

        # Check length
        if len(user_input) > self.max_input_length:
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="validation",
                    message=f"Input exceeds max length ({len(user_input)} > {self.max_input_length})",
                    details={"user_id": user_id, "input_length": len(user_input)},
                )
            )
            return False

        # Check for control characters
        if not self._is_valid_utf8(user_input):
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="validation",
                    message="Invalid UTF-8 encoding detected",
                    details={"user_id": user_id},
                )
            )
            return False

        # Check for null bytes
        if "\x00" in user_input:
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="validation",
                    message="Null bytes detected in input",
                    details={"user_id": user_id},
                )
            )
            return False

        # Check for prompt injection
        if self._detect_injection(user_input):
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.CRITICAL,
                    category="injection",
                    message="Prompt injection attempt detected",
                    details={"user_id": user_id, "input_hash": hashlib.sha256(user_input.encode()).hexdigest()},
                )
            )
            return False

        return True

    def _is_valid_utf8(self, text: str) -> bool:
        """Check if text is valid UTF-8"""
        try:
            text.encode("utf-8").decode("utf-8")
            return True
        except (UnicodeDecodeError, UnicodeEncodeError):
            return False

    def _detect_injection(self, text: str) -> bool:
        """Detect prompt injection patterns"""
        lower_text = text.lower()
        for pattern in self.injection_patterns:
            if re.search(pattern, lower_text, re.IGNORECASE):
                return True
        return False

    # ==================== TOOL VALIDATION ====================

    def validate_tool(
        self,
        tool_name: str,
        tool_args: str,
        available_tools: List[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate tool name and arguments.
        
        Args:
            tool_name: Name of the tool to execute
            tool_args: Stringified arguments
            available_tools: List of allowed tool names
            
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        # Validate tool name
        if not tool_name or not isinstance(tool_name, str):
            error_msg = "Invalid tool name"
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="tool_access",
                    message=error_msg,
                    details={"tool_name": tool_name},
                )
            )
            return False, error_msg

        # Check against whitelist
        if available_tools and tool_name not in available_tools:
            error_msg = f"Tool '{tool_name}' is not in whitelist"
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.CRITICAL,
                    category="tool_access",
                    message=error_msg,
                    details={"requested_tool": tool_name, "available": available_tools},
                )
            )
            return False, error_msg

        # Validate arguments
        if not self._is_safe_tool_args(tool_args):
            error_msg = f"Tool arguments contain dangerous patterns"
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.CRITICAL,
                    category="tool_access",
                    message=error_msg,
                    details={"tool_name": tool_name, "args_hash": hashlib.sha256(tool_args.encode()).hexdigest()},
                )
            )
            return False, error_msg

        return True, None

    def _is_safe_tool_args(self, args: str) -> bool:
        """Check if tool arguments contain dangerous patterns"""
        if not args:
            return True

        lower_args = args.lower()
        for pattern in self.dangerous_code_patterns:
            if re.search(pattern, lower_args, re.IGNORECASE):
                return False
        return True

    # ==================== OUTPUT SAFETY ====================

    def sanitize_output(self, text: str) -> str:
        """
        Remove or mask sensitive information from output.
        
        Args:
            text: Output text to sanitize
            
        Returns:
            str: Sanitized text
        """
        sanitized = text
        
        # Mask email addresses
        sanitized = re.sub(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "[email_masked]",
            sanitized
        )

        # Mask phone numbers
        sanitized = re.sub(
            r"\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b",
            "[phone_masked]",
            sanitized
        )

        # Mask API keys
        sanitized = re.sub(
            r"(?:api[_-]?key|apikey|secret)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}",
            "[secret_masked]",
            sanitized,
            flags=re.IGNORECASE
        )

        # Mask tokens
        sanitized = re.sub(
            r"(?:token|bearer|auth)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}",
            "[token_masked]",
            sanitized,
            flags=re.IGNORECASE
        )

        # Remove HTML/script tags
        sanitized = re.sub(r"<script[^>]*>.*?</script>", "", sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r"<iframe[^>]*>.*?</iframe>", "", sanitized, flags=re.IGNORECASE | re.DOTALL)

        return sanitized

    def validate_output(self, text: str) -> bool:
        """
        Check if output contains sensitive data that shouldn't be exposed.
        
        Returns:
            bool: True if output is safe, False otherwise
        """
        for pattern_name, pattern in self.sensitive_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                self.log_event(
                    SecurityEvent(
                        level=SecurityLevel.CRITICAL,
                        category="validation",
                        message=f"Sensitive data ({pattern_name}) detected in output",
                        details={"pattern": pattern_name},
                    )
                )
                return False
        return True

    # ==================== RESOURCE LIMITS ====================

    def track_resource_usage(
        self,
        request_id: str,
        input_tokens: int,
        output_tokens: int,
        steps: int,
        latency_ms: float,
    ) -> bool:
        """
        Track resource usage for a request.
        
        Returns:
            bool: True if within limits, False if exceeded
        """
        total_tokens = input_tokens + output_tokens

        # Check token budget
        if total_tokens > self.max_tokens:
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="resource",
                    message=f"Token budget exceeded ({total_tokens} > {self.max_tokens})",
                    details={
                        "request_id": request_id,
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                    },
                )
            )
            return False

        # Check step limit
        if steps > self.max_steps:
            self.log_event(
                SecurityEvent(
                    level=SecurityLevel.WARNING,
                    category="resource",
                    message=f"Step limit exceeded ({steps} > {self.max_steps})",
                    details={"request_id": request_id, "steps": steps},
                )
            )
            return False

        return True

    # ==================== SECURITY REPORTING ====================

    def get_security_report(self, limit: int = 100) -> Dict[str, Any]:
        """Generate a security report"""
        events = self.security_events[-limit:]
        
        critical_count = sum(1 for e in events if e.level == SecurityLevel.CRITICAL)
        warning_count = sum(1 for e in events if e.level == SecurityLevel.WARNING)
        info_count = sum(1 for e in events if e.level == SecurityLevel.INFO)

        return {
            "total_events": len(events),
            "critical": critical_count,
            "warning": warning_count,
            "info": info_count,
            "events": [
                {
                    "level": e.level.value,
                    "category": e.category,
                    "message": e.message,
                    "timestamp": e.timestamp,
                }
                for e in events
            ],
        }


# Global validator instance
_validator = GuardrailsValidator()


def get_validator() -> GuardrailsValidator:
    """Get the global validator instance"""
    return _validator
