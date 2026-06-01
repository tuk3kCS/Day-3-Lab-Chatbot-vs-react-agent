"""
PII redaction for VinWonders travel agent (booking, email notifications, itineraries).
"""

import re
from typing import Dict, List, Pattern, Tuple

# Placeholders — stable for logs and user-facing masked output
REDACT_EMAIL = "[email_redacted]"
REDACT_PHONE = "[phone_redacted]"
REDACT_VN_ID = "[id_redacted]"
REDACT_PASSPORT = "[passport_redacted]"
REDACT_CARD = "[card_redacted]"
REDACT_SECRET = "[secret_redacted]"
REDACT_TOKEN = "[token_redacted]"

PII_PATTERNS: List[Tuple[str, Pattern[str], str]] = [
    (
        "email",
        re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            re.IGNORECASE,
        ),
        REDACT_EMAIL,
    ),
    (
        "phone_vn",
        re.compile(
            r"(?<!\d)(?:\+?84|0)(?:[\s.-]?)(?:3|5|7|8|9)(?:[\s.-]?\d){8}(?!\d)",
            re.IGNORECASE,
        ),
        REDACT_PHONE,
    ),
    (
        "phone_intl",
        re.compile(
            r"\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b"
        ),
        REDACT_PHONE,
    ),
    (
        "cccd",
        re.compile(r"\b\d{12}\b"),
        REDACT_VN_ID,
    ),
    (
        "cmnd",
        re.compile(r"\b\d{9}\b"),
        REDACT_VN_ID,
    ),
    (
        "passport",
        re.compile(r"\b[A-Z]{1,2}\d{6,9}\b"),
        REDACT_PASSPORT,
    ),
    (
        "credit_card",
        re.compile(r"\b(?:\d{4}[\s-]?){3}\d{4}\b"),
        REDACT_CARD,
    ),
    (
        "api_key",
        re.compile(
            r"(?:api[_-]?key|apikey|secret)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}",
            re.IGNORECASE,
        ),
        REDACT_SECRET,
    ),
    (
        "token",
        re.compile(
            r"(?:token|bearer|auth)['\"]?\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}",
            re.IGNORECASE,
        ),
        REDACT_TOKEN,
    ),
    (
        "ssn",
        re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        REDACT_VN_ID,
    ),
]


def redact_pii(text: str) -> str:
    """Mask PII in free text (responses, logs, tool output)."""
    if not text:
        return text

    result = text
    for _name, pattern, replacement in PII_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def detect_pii_types(text: str) -> List[str]:
    """Return names of PII pattern types found in text."""
    if not text:
        return []

    found: List[str] = []
    for name, pattern, _replacement in PII_PATTERNS:
        if pattern.search(text):
            found.append(name)
    return found


def contains_pii(text: str) -> bool:
    return bool(detect_pii_types(text))


def redact_mapping(data: Dict[str, object]) -> Dict[str, object]:
    """Redact string values in a shallow dict (tool args, log fields)."""
    redacted: Dict[str, object] = {}
    for key, value in data.items():
        if isinstance(value, str):
            redacted[key] = redact_pii(value)
        else:
            redacted[key] = value
    return redacted
