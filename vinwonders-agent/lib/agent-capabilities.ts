/**
 * Mô tả chức năng agent — trả lời cố định khi khách hỏi "bạn giúp được gì".
 */

export const CAPABILITIES_REPLY = `Chào bạn! Mình là trợ lý AI tại VinWonders. Hiện mình có thể hỗ trợ:

• **Tìm & gợi ý địa điểm** — trò chơi (tàu lượn Zeus…), nhà hàng, show (Tata World…), khách sạn, tiện ích (thủy cung, Safari…), kể cả gợi ý khi trời mưa.

• **Đặt bàn nhà hàng** — giữ chỗ theo tên nhà hàng, số người, giờ đến và tên khách (demo trong lab).

• **Sự cố khẩn cấp** — mất đồ/ví/điện thoại, lạc trẻ: tạo mã ticket và hướng dẫn liên hệ an ninh; sự cố y tế được ưu tiên.

• **Thông tin liên hệ** — quầy thông tin, y tế, an ninh trong công viên.

Bạn thử hỏi ví dụ:
— "Trời mưa nên đi đâu?"
— "Đặt bàn Nhà hàng Hải Vương 4 người lúc 12:30"
— "Mất ví ở tàu lượn, giúp với!"`;

const CAPABILITIES_PATTERNS: RegExp[] = [
  /(?:bạn|ban|mình|minh|agent|trợ lý|tro ly|ai)\s*(?:có thể|co the|cho thể|cho the)?\s*(?:giúp|giup|hỗ trợ|ho tro)/i,
  /(?:giúp|giup|hỗ trợ|ho tro)\s*(?:gì|gi|được gì|duoc gi|tôi|toi|mình|minh|em)\s*(?:gì|gi|được|duoc)?/i,
  /(?:làm|lam)\s*(?:được|duoc)\s*gì/i,
  /(?:chức năng|chuc nang|tính năng|tinh nang|khả năng|kha nang)/i,
  /(?:bạn|ban|mình|minh)\s+là\s+(?:ai|gì|gi)/i,
  /what\s*can\s*you\s*(?:do|help)/i,
  /hướng dẫn\s*sử dụng|huong dan su dung/i,
  /(?:dịch vụ|dich vu)\s*(?:nào|nao|gì|gi)/i,
  /(?:có|co)\s*(?:những|nhung)?\s*(?:gì|gi)\s*(?:bạn|ban|mình|minh)\s*(?:làm|lam)/i,
];

/** Tránh nhầm với "giới thiệu Zeus / nhà hàng …" */
const NOT_CAPABILITIES =
  /(?:giới thiệu|gioi thieu).*(?:zeus|tàu lượn|tau luon|safari|show|nhà hàng|nha hang|thủy cung|thuy cung|buffet|tata|hải vương|hai vuong)/i;

export function isCapabilitiesQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (NOT_CAPABILITIES.test(trimmed)) return false;
  return CAPABILITIES_PATTERNS.some((p) => p.test(trimmed));
}
