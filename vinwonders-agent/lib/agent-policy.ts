/**
 * Giới hạn & guardrails — giúp agent phản hồi ngắn gọn, đúng phạm vi VinWonders.
 */

export const AGENT_LIMITS = {
  /** Độ dài tối đa mỗi tin nhắn khách */
  maxUserMessageChars: Number(process.env.MAX_USER_MESSAGE_CHARS) || 800,
  /** Token output tối đa (chat thường) — model nhỏ nên giữ ngắn */
  maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS) || 320,
  /** Sau khi gọi tool — chỉ tóm tắt */
  maxOutputTokensAfterTool: Number(process.env.MAX_OUTPUT_TOKENS_TOOL) || 180,
  /** Nhiệt độ thấp → ít lan man */
  temperature: Number(process.env.AGENT_TEMPERATURE) || 0.35,
  /** Số câu gợi ý tối đa trong lời thoại (Karpathy: đơn giản trước tiên) */
  maxSentencesHint: Number(process.env.MAX_RESPONSE_SENTENCES) || 3,
  /** Vòng gọi tool tối đa mỗi lượt (native tools / AI SDK) */
  maxAgentToolSteps: Number(process.env.MAX_AGENT_TOOL_STEPS) || 3,
  /** Tối đa lần gọi cùng một tool trong phiên */
  maxSameToolPerSession: Number(process.env.MAX_SAME_TOOL_PER_SESSION) || 6,
  /** Chặn (không trả lời) khi cùng câu user lặp N lần liên tiếp */
  maxConsecutiveDuplicateUserMessages:
    Number(process.env.MAX_CONSECUTIVE_DUPLICATE_USER) || 3,
  /** Chặn khi N lần tool liên tiếp cùng tên */
  maxConsecutiveSameTool: 2,
} as const;

const SCOPE_RULES = `## Phạm vi (in-scope only)

Bạn CHỈ hỗ trợ khách tại **VinWonders** (công viên, nhà hàng, show, khách sạn, an ninh, đặt bàn).

**Được phép:** gợi ý địa điểm trong hệ thống, lịch trình tham quan, đặt bàn, sự cố mất đồ/y tế, giờ mở cửa, mẹo tham quan **khi khách hỏi**.

**KHÔNG được (out of scope — từ chối, không triển khai):**
- Bài tập, lập trình, tin tức, chính trị, tài chính, y khoa chuyên sâu, pháp lý, nấu ăn chung…
- Gọi công cụ khi câu hỏi không liên quan công viên
- Bịa dữ liệu; hứa hoàn tiền / đổi chính sách công ty (chỉ mô tả demo)
- Trả lời dài hoặc “dạy” thêm kiến thức ngoài câu hỏi

**Giọng điệu:** thân thiện, tiếng Việt, gạch đầu dòng khi liệt kê địa điểm.

**Hỏi chức năng:** 4 nhóm ngắn (tìm địa điểm, đặt bàn, khẩn cấp, liên hệ) + tối đa 2 ví dụ câu hỏi.`;

export const OFF_TOPIC_REPLY =
  'Mình chỉ hỗ trợ thông tin và dịch vụ tại VinWonders (địa điểm, ăn uống, show, đặt bàn, sự cố trong công viên). Bạn cần gợi ý gì khi tham quan ạ?';

export const MESSAGE_TOO_LONG_REPLY = `Tin nhắn hơi dài (giới hạn ${AGENT_LIMITS.maxUserMessageChars} ký tự). Bạn gửi ngắn lại hoặc tách thành vài câu hỏi nhé.`;

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /viết\s+(code|chương trình)|lập trình|python|javascript|typescript|react\s+js/i,
  /bài tập|homework|giải hộ|làm hộ/i,
  /chính trị|bầu cử|đảng |chủ tịch|thủ tướng/i,
  /crypto|bitcoin|đầu tư chứng khoán|forex/i,
  /công thức nấu(?!.*vinwonders)/i,
  /chẩn đoán bệnh|kê đơn thuốc|liều lượng thuốc/i,
  /tin tức|tin tuc|thời sự|thoi su|tình hình|tinh hinh|chiến sự|chien su|chiến tranh|chien tranh/i,
  /quân sự|quan su|xung đột|xung dot|biến động thế giới|trung đông|trung dong/i,
  /\b(iran|israel|ukraine|gaza|nato|hamas|lebanon|syria)\b/i,
  /giá vàng|gia vang|chứng khoán|lãi suất|tỷ giá|ty gia/i,
  /(?:giải thích|giai thich|phân tích|phan tich|so sánh|so sanh)\s+(?:lịch sử|lich su|thế giới|the gioi|kinh tế|kinh te)/i,
  /(?:viết|viet)\s+(?:bài|bai|essay|luận|luan)/i,
];

const IN_SCOPE_PATTERNS: RegExp[] = [
  /vinwonders|vin wonders|công viên|nha hang|nhà hàng|đặt bàn|dat ban/i,
  /mất đồ|mất ví|khẩn cấp|thủy cung|tàu lượn|zeus|safari|show|tata/i,
  /gợi ý|đề xuất|chơi đâu|ăn|vé|giờ mở/i,
  /giúp gì|giup gi|chức năng|chuc nang|làm được gì|lam duoc gi|bạn là ai|ban la ai|hỗ trợ gì|ho tro gi/i,
];

export type UserMessageValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'too_long'; message: string };

export function validateUserMessage(text: string): UserMessageValidation {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty', message: 'Vui lòng nhập nội dung câu hỏi.' };
  }
  if (trimmed.length > AGENT_LIMITS.maxUserMessageChars) {
    return { ok: false, reason: 'too_long', message: MESSAGE_TOO_LONG_REPLY };
  }
  return { ok: true };
}

/** Phân loại nhanh — tránh gọi LLM cho câu rõ ràng ngoài phạm vi */
export function isClearlyOffTopic(text: string): boolean {
  const lower = text.toLowerCase();
  if (IN_SCOPE_PATTERNS.some((p) => p.test(lower))) return false;
  return OFF_TOPIC_PATTERNS.some((p) => p.test(lower));
}

export function buildAgentSystemPrompt(
  memorySummary: string,
  karpathyRules: string,
): string {
  const base = `Bạn là trợ lý ảo AI túc trực tại VinWonders.

${SCOPE_RULES}

${karpathyRules}`;

  if (!memorySummary) return base;
  return `${base}\n\n${memorySummary}`;
}

export function getStreamSettings(options?: { afterTool?: boolean }) {
  return {
    maxOutputTokens: options?.afterTool
      ? AGENT_LIMITS.maxOutputTokensAfterTool
      : AGENT_LIMITS.maxOutputTokens,
    temperature: AGENT_LIMITS.temperature,
  };
}
