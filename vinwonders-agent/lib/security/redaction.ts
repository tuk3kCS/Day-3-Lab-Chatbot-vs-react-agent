/**
 * PII redaction — VinWonders (đặt phòng, email lịch trình, liên hệ khách).
 */

export const REDACT_EMAIL = '[email_redacted]';
export const REDACT_PHONE = '[phone_redacted]';
export const REDACT_VN_ID = '[id_redacted]';
export const REDACT_PASSPORT = '[passport_redacted]';
export const REDACT_CARD = '[card_redacted]';
export const REDACT_SECRET = '[secret_redacted]';
export const REDACT_TOKEN = '[token_redacted]';

const PII_RULES: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
    replacement: REDACT_EMAIL,
  },
  {
    name: 'phone_vn',
    pattern: /(?<!\d)(?:\+?84|0)(?:[\s.-]?)(?:3|5|7|8|9)(?:[\s.-]?\d){8}(?!\d)/gi,
    replacement: REDACT_PHONE,
  },
  {
    name: 'phone_intl',
    pattern:
      /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    replacement: REDACT_PHONE,
  },
  { name: 'cccd', pattern: /\b\d{12}\b/g, replacement: REDACT_VN_ID },
  { name: 'cmnd', pattern: /\b\d{9}\b/g, replacement: REDACT_VN_ID },
  {
    name: 'passport',
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    replacement: REDACT_PASSPORT,
  },
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    replacement: REDACT_CARD,
  },
  {
    name: 'api_key',
    pattern:
      /(?:api[_-]?key|apikey|secret)['":\s=]+[a-zA-Z0-9_\-]{20,}/gi,
    replacement: REDACT_SECRET,
  },
  {
    name: 'token',
    pattern: /(?:token|bearer|auth)['":\s=]+[a-zA-Z0-9_\-]{20,}/gi,
    replacement: REDACT_TOKEN,
  },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: REDACT_VN_ID },
];

export function redactPii(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of PII_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function detectPiiTypes(text: string): string[] {
  if (!text) return [];
  return PII_RULES.filter(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }).map(({ name }) => name);
}

export function containsPii(text: string): boolean {
  return detectPiiTypes(text).length > 0;
}
