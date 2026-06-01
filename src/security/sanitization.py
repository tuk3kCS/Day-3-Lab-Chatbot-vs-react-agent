"""
Input/output sanitization — strip dangerous content before LLM or logging.
"""

import re
import unicodedata
from typing import Any, Dict, List, Union

from src.security.redaction import redact_pii

# Control chars except common whitespace used in chat
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_NULL_BYTE_RE = re.compile(r"\x00")

_SCRIPT_TAG_RE = re.compile(
    r"<script[^>]*>.*?</script>",
    re.IGNORECASE | re.DOTALL,
)
_IFRAME_TAG_RE = re.compile(
    r"<iframe[^>]*>.*?</iframe>",
    re.IGNORECASE | re.DOTALL,
)
_JAVASCRIPT_URI_RE = re.compile(r"javascript\s*:", re.IGNORECASE)

# Path traversal / SQL-ish fragments in tool args
_DANGEROUS_FRAGMENTS = [
    re.compile(r"\.\./"),
    re.compile(r"';?\s*DROP\s+TABLE", re.IGNORECASE),
    re.compile(r"';?\s*DELETE\s+FROM", re.IGNORECASE),
]


def normalize_unicode(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def strip_control_characters(text: str) -> str:
    if not text:
        return text
    cleaned = _NULL_BYTE_RE.sub("", text)
    return _CONTROL_CHAR_RE.sub("", cleaned)


def remove_active_content(text: str) -> str:
    """Remove script/iframe tags and javascript: URIs from model or tool output."""
    if not text:
        return text
    result = _SCRIPT_TAG_RE.sub("", text)
    result = _IFRAME_TAG_RE.sub("", result)
    result = _JAVASCRIPT_URI_RE.sub("", result)
    return result


def contains_dangerous_fragments(text: str) -> bool:
    if not text:
        return False
    return any(p.search(text) for p in _DANGEROUS_FRAGMENTS)


def sanitize_user_input(text: str, max_length: int = 2000) -> str:
    """
  Prepare user message for the agent: normalize, strip controls, cap length.
  Does not redact PII (booking flows need email/phone until persisted securely).
    """
    if not text or not isinstance(text, str):
        return ""

    cleaned = normalize_unicode(strip_control_characters(text.strip()))
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned


def sanitize_output_text(text: str) -> str:
    """Full pipeline for agent responses: strip active content + redact PII."""
    if not text:
        return text
    return redact_pii(remove_active_content(text))


def sanitize_for_logging(value: Any, max_str_len: int = 500) -> Any:
    """Recursively redact PII and truncate strings before writing logs."""
    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        truncated = value if len(value) <= max_str_len else f"{value[:max_str_len]}…"
        return redact_pii(truncated)

    if isinstance(value, dict):
        return {str(k): sanitize_for_logging(v, max_str_len) for k, v in value.items()}

    if isinstance(value, (list, tuple)):
        return [sanitize_for_logging(item, max_str_len) for item in value]

    return redact_pii(str(value)[:max_str_len])
