# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: Hoàng Đức Trường
- **Student ID**: 2A202600552
- **Date**: 01/06/2026

---
# I. Technical Contribution (15 Points)
Đóng góp chính: xây dựng Weather tool và Ticket Search tool cho agent VinWonders, tích hợp vào use client component (ChatMessage, tool-cards), đồng bộ server tool detection và **UI rendering.*

Bối cảnh nghiệp vụ
Agent hỗ trợ khách du lịch tại VinWonders với hai nhu cầu thực tế:

Tra cứu thời tiết — khách hỏi "hôm nay thời tiết thế nào?", "có mưa không?"

Tra cứu giá vé tham quan — khách hỏi "giá vé VinWonders bao nhiêu?", "vé Ba Na Hills"

→ Hai tool này read-only, không thay đổi dữ liệu, cần UI card riêng biệt để hiển thị kết quả trực quan.

Modules đã triển khai / cập nhật
Module	Vai trò	Loại contribution
lib/server-tools.ts	runWeather() - gọi API wttr.in, trả về JSON	Backend logic
lib/server-tools.ts	runSearchTicket() - tra cứu database vé cứng	Backend logic
lib/server-tools.ts	TICKET_SEARCH_INTENT regex + extractTicketDestination()	Intent detection
lib/server-tools.ts	WEATHER_INTENT regex	Intent detection
components/tool-cards.tsx	WeatherCard component	UI rendering
components/tool-cards.tsx	TicketSearchCard component	UI rendering
components/chat-message.tsx	Tool part routing cho tool-weather và tool-searchTicket	UI integration
components/tool-cards.tsx	ToolLoadingCard cho loading states	UX improvement

# Code highlights
1. Weather tool — gọi API thời tiết real-time
typescript
// lib/server-tools.ts
export async function runWeather(location: string) {
  const response = await fetch(
    `https://wttr.in/${encodeURIComponent(location)}?format=3`
  );

  if (!response.ok) {
    throw new Error('Weather service unavailable');
  }

  const weather = await response.text();

  return {
    location,
    weather,  // Ví dụ: "Phu Quoc: 🌦 +28°C"
  };
}
Intent detection:

typescript
const WEATHER_INTENT = /(thời tiết|thoi tiet|nhiệt độ|nhiet do|mưa không|mua khong|nắng không|nang khong|weather|temperature)/i;

if (WEATHER_INTENT.test(lower)) {
  const cityMatch = trimmed.match(/(?:ở|tai|tại)\s+(.+)$/i);
  return {
    name: 'weather',
    input: { location: cityMatch?.[1]?.trim() || 'Phu Quoc' },
  };
}
 2. Ticket Search tool — database cứng cho giá vé
typescript
// lib/server-tools.ts
const TICKET_DATABASE: Record<string, {
  name: string;
  tickets: { type: string; price: number }[];
  combos?: { name: string; adult: number; child: number }[];
  openingHours?: string;
}> = {
  'vinwonders phu quoc': {
    name: 'VinWonders Phú Quốc',
    tickets: [
      { type: 'Người lớn', price: 950000 },
      { type: 'Trẻ em', price: 710000 },
      { type: 'Người cao tuổi', price: 710000 },
    ],
    combos: [{ name: 'VinWonders + Safari', adult: 1350000, child: 1000000 }],
    openingHours: '09:00 – 19:30',
  },
  'ba na hills': {
    name: 'Ba Na Hills',
    tickets: [
      { type: 'Người lớn', price: 900000 },
      { type: 'Trẻ em', price: 750000 },
    ],
    openingHours: '07:00 – 22:00',
  },
};
Intent detection (ưu tiên trước TRANSPORT_INTENT để tránh bị "ticket" cướp):

typescript
const TICKET_SEARCH_INTENT = /(giá vé|gia ve|vé vào cổng|ve vao cong|vé tham quan|ve tham quan|giá ticket|gia ticket|bao nhiêu.*vé|vé.*bao nhiêu|tra cứu vé|tra cuu ve|tìm vé|tim ve|vé vào|ve vao|ticket price|entry fee|admission)/i;
 3. UI Components — WeatherCard
tsx
// components/tool-cards.tsx
export function WeatherCard({ result }: { result: WeatherResult }) {
  return (
    <article className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] p-4">
      <h3 className="font-semibold">
        Thời tiết tại {result.location}
      </h3>
      <p className="mt-2 text-sm text-zinc-300">
        {result.weather}
      </p>
    </article>
  );
}
4. UI Components — TicketSearchCard (hiển thị bảng giá)
tsx
export function TicketSearchCard({ result }: { result: TicketSearchResult }) {
  if (!result.found || !result.info) {
    return (
      <article className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] p-4">
        <p className="text-sm text-zinc-400">{result.message}</p>
      </article>
    );
  }

  const { info } = result;

  return (
    <article className="overflow-hidden rounded-2xl border border-amber-800/60 bg-gradient-to-br from-amber-950/80 to-amber-950/40">
      <div className="flex items-center gap-2 border-b border-amber-800/40 bg-amber-900/30 px-4 py-3">
        <Tag className="h-5 w-5 text-amber-400" />
        <span className="text-sm font-bold tracking-wide text-amber-300">
          Giá vé — {info.name}
        </span>
      </div>
      <div className="space-y-3 p-4">
        {/* Bảng giá vé */}
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/50 divide-y divide-amber-800/30">
          {info.tickets.map((t) => (
            <div key={t.type} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-zinc-300">{t.type}</span>
              <span className="font-semibold text-amber-200">
                {t.price === 0 ? 'Miễn phí' : `${t.price.toLocaleString('vi-VN')}đ`}
              </span>
            </div>
          ))}
        </div>
        {/* Giờ mở cửa */}
        {info.openingHours && (
          <div className="flex items-center justify-between rounded-xl bg-amber-900/30 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="h-3.5 w-3.5" /> Giờ mở cửa
            </span>
            <span className="text-sm font-medium text-zinc-200">{info.openingHours}</span>
          </div>
        )}
      </div>
    </article>
  );
}
5. ChatMessage routing (use client)
tsx
// components/chat-message.tsx
if (part.type === 'tool-weather') {
  if (part.state === 'input-available' || part.state === 'input-streaming') {
    return <ToolLoadingCard key={index} label="Đang lấy thông tin thời tiết..." />;
  }
  if (part.state === 'output-available') {
    return <WeatherCard key={index} result={part.output as WeatherResult} />;
  }
}

if (part.type === 'tool-searchTicket') {
  if (part.state === 'input-available' || part.state === 'input-streaming') {
    return <ToolLoadingCard key={index} label="Đang tra cứu giá vé..." />;
  }
  if (part.state === 'output-available') {
    return <TicketSearchCard key={index} result={part.output as TicketSearchResult} />;
  }
}
6. Type definitions
typescript
// components/types.ts
export type WeatherResult = {
  location: string;
  weather: string;
};

export type TicketSearchResult = {
  found: boolean;
  destination: string;
  info: {
    name: string;
    tickets: { type: string; price: number }[];
    combos?: { name: string; adult: number; child: number }[];
    openingHours?: string;
  } | null;
  message?: string;
};
Luồng dữ liệu hoàn chỉnh
text
User: "Giá vé VinWonders bao nhiêu?"
  ↓
detectServerTool() → TICKET_SEARCH_INTENT matches
  ↓
{ name: 'searchTicket', input: { destination: 'vinwonders phu quoc' } }
  ↓
runSearchTicket() → TICKET_DATABASE lookup
  ↓
UI: TicketSearchCard hiển thị bảng giá + combo + giờ mở cửa
# II. Debugging Case Study (10 Points)
Case A — Weather API trả về undefined / lỗi CORS khi fetch từ client
Mô tả vấn đề

runWeather được gọi từ server tool (Next.js API route) nhưng ban đầu em thử fetch trực tiếp từ client component.

Triệu chứng: wttr.in API trả về HTML thay vì plain text khi không đúng headers, hoặc bị CORS block.

Chẩn đoán

wttr.in mặc định trả về HTML + ANSI cho terminal.

Cần query param ?format=3 để lấy plain text.

Fetch từ server-side (API route) tránh CORS hoàn toàn.

Giải pháp

typescript
// ✅ Gọi từ server tool (lib/server-tools.ts)
export async function runWeather(location: string) {
  const response = await fetch(
    `https://wttr.in/${encodeURIComponent(location)}?format=3`
  );
  // Server-side fetch → không CORS
}
Kết quả: Weather hoạt động ổn định, trả về text như "Phu Quoc: 🌦 +28°C".

Case B — Ticket Search không match intent khi hỏi "vé bao nhiêu?"
Mô tả vấn đề

User hỏi: "Vé VinWonders bao nhiêu tiền?"

detectServerTool không nhận diện → fallback sang searchDestination → trả về gợi ý địa điểm thay vì giá vé.

Chẩn đoán

Regex cũ chỉ có giá vé|gia ve — thiếu pattern vé.*bao nhiêu.

Thứ tự ưu tiên: TICKET_SEARCH_INTENT phải trước TRANSPORT_INTENT (vì transport cũng có từ "ticket").

Giải pháp

typescript
// Mở rộng regex
const TICKET_SEARCH_INTENT = /(giá vé|gia ve|vé vào cổng|ve vao cong|vé tham quan|ve tham quan|giá ticket|gia ticket|bao nhiêu.*vé|vé.*bao nhiêu|tra cứu vé|tra cuu ve|tìm vé|tim ve|vé vào|ve vao|ticket price|entry fee|admission)/i;

// Đặt trước TRANSPORT_INTENT
if (TICKET_SEARCH_INTENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
  return { name: 'searchTicket', input: { destination: extractTicketDestination(trimmed) } };
}

// TRANSPORT_INTENT ở sau
if (TRANSPORT_INTENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
  // ...
}
Kết quả: "Vé VinWonders bao nhiêu?" → searchTicket → hiển thị bảng giá.

Case C — TicketSearchCard lỗi TypeScript khi result.info là null
Mô tả vấn đề

Khi không tìm thấy vé (ví dụ "vé Đà Nẵng"), result.info = null.

Component cố gắng truy cập info.tickets → runtime error.

Chẩn đoán

Type định nghĩa:

typescript
type TicketSearchResult = {
  found: boolean;
  info: { ... } | null;  // ← có thể null
}
Nhưng component không kiểm tra found trước.

Giải pháp

tsx
export function TicketSearchCard({ result }: { result: TicketSearchResult }) {
  // ✅ Kiểm tra found trước
  if (!result.found || !result.info) {
    return (
      <article className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] p-4">
        <p className="text-sm text-zinc-400">{result.message}</p>
      </article>
    );
  }
  // ... render info
}
Kết quả: Fallback an toàn, hiển thị message "Không tìm thấy thông tin vé cho...".

# III. Personal Insights: Chatbot vs ReAct (10 Points)
Góc nhìn sau khi thêm weather + ticket tool vào agent.

1. Tool的种类与安全边界
Tool类型	示例	副作用	需要的安全措施
Read-only	Weather, Ticket Search	无	低 — 只需rate limit
Write	BookRestaurant, BuyTicket	有 (创建booking)	高 — 需确认、PII保护
Emergency	HandleEmergency	有 (触发响应流程)	最高 — 优先执行，但需审计
Insight: Weather和Ticket Search属于只读工具，实现简单，但同样需要:

良好的loading状态 (ToolLoadingCard)

结构化UI展示 (card而不是纯文本)

优雅的fallback (API失败时)

2. UI作为Agent的一部分 — 重要但易被忽视
Chatbot纯文本时代，所有输出都是LLM生成的markdown。但Tool Agent需要:

tsx
// ❌ Chỉ text — user khó đọc bảng giá
"Giá vé người lớn 950,000đ, trẻ em 710,000đ"

// ✅ UI Card — trực quan, dễ so sánh
<TicketSearchCard result={...} />
Học được:

Server tool trả về structured data (JSON)

Client render dedicated card cho mỗi tool type

Loading state quan trọng (user biết agent đang làm gì)

3. Intent detection thứ tự quan trọng hơn độ phức tạp
typescript
// Thứ tự quyết định behavior
if (EMERGENCY) → handleEmergency
else if (BOOKING) → bookRestaurant
else if (TICKET_SEARCH) → searchTicket    // ← Phải trước TRANSPORT
else if (TRANSPORT) → buyTransportTicket
else if (WEATHER) → weather
else if (EXPLORATION) → searchDestination
Case study: "Mua vé xe buýt đi Safari" → TRANSPORT_INTENT; "Giá vé VinWonders" → TICKET_SEARCH_INTENT. Nếu đặt TRANSPORT trước, câu thứ hai sẽ bị nhận diện sai.

4. So sánh Chatbot vs ReAct Agent (bổ sung từ Lab 3)
Khía cạnh	Chatbot đơn thuần	ReAct Agent (với tools)
Thời tiết	LLM hallucinate "có thể 28 độ"	API thật → chính xác
Giá vé	Hallucinate hoặc outdated	Database cứng → đúng
Loading state	Không có	ToolLoadingCard rõ ràng
UX cho structured data	Markdown bảng thủ công	UI Card chuyên dụng
Bảo mật PII	Thấp hơn (ít tool hơn)	Cao hơn (nhiều input hơn)
Kết luận: Với read-only tool (weather, ticket search), ReAct agent vượt trội hoàn toàn so với chatbot vì:

Dữ liệu real-time (weather API) — chatbot không thể

Dữ liệu chính xác (giá vé từ database) — chatbot hallucinate

UI trực quan (card thay vì text) — UX tốt hơn

5. Insight từ việc implement weather tool
API design: wttr.in đơn giản nhưng cần ?format=3 để parse dễ.

Fallback: Nếu API fail → trả về message rõ ràng, không crash agent.

Location extraction: Regex (?:ở|tai|tại)\s+(.+) để lấy tên thành phố.

typescript
// Ví dụ user hỏi "Thời tiết ở Hà Nội"
const cityMatch = trimmed.match(/(?:ở|tai|tại)\s+(.+)$/i);
// cityMatch[1] = "Hà Nội"
IV. Future Improvements (5 Points)
Scalability
Ticket database: Hiện hardcoded → chuyển sang CMS hoặc API (Redis cache)

Weather API: Thêm fallback API (OpenWeatherMap) khi wttr.in down

Safety (cho write tools đã có, nhưng read-only cũng cần)
Rate limit cho weather API (tránh spam 100 requests/phút)

Validate location input (chặn injection qua URL)

Performance
Cache weather: Nếu cùng location trong 10 phút, dùng cache thay vì fetch lại

Ticket search: O(1) với Map thay vì Object.keys loop mỗi lần

Observability
Log tool usage: Ghi lại tool-weather, tool-searchTicket vào metrics.jsonl

Track API failure rate cho weather (alert nếu >5% fail)

UI Improvements
Weather icon: Parse kết quả từ wttr.in để hiển thị icon 🌦 ☀️ 🌧

Ticket comparison: Cho phép user compare giá giữa các khu

Tổng kết
Trong Lab 3, em đã:

Xây dựng 2 tool mới cho VinWonders Agent:

weather — gọi API real-time, hiển thị WeatherCard

searchTicket — tra cứu database giá vé, hiển thị TicketSearchCard

Tích hợp hoàn chỉnh từ intent detection → server tool → UI component (use client)

Xử lý 3 case debugging:

Weather API CORS (giải pháp: server-side fetch)

Intent không match "vé bao nhiêu" (mở rộng regex + thứ tự ưu tiên)

TypeScript error với nullable result (guard clause)

Rút ra insight:

Read-only tool an toàn hơn nhưng vẫn cần loading state + error handling

UI Card quan trọng hơn text đối với structured data (giá vé, thời tiết)

Intent detection thứ tự ảnh hưởng lớn đến behavior

Hệ thống hiện hỗ trợ đầy đủ: thời tiết thật, giá vé chính xác, đặt bàn nhà hàng, vé xe buýt, khẩn cấp — đáp ứng nhu cầu đa dạng của khách du lịch VinWonders.

Phụ lục — Cấu trúc file liên quan
File	Vai trò
lib/server-tools.ts	runWeather, runSearchTicket, intent detection
components/tool-cards.tsx	WeatherCard, TicketSearchCard
components/chat-message.tsx	Routing tool-weather / tool-searchTicket
components/types.ts	WeatherResult, TicketSearchResult
