# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: Hoàng Đức Trường
- **Student ID**: 2A202600552
- **Date**: 01/06/2026

---

## I. Technical Contribution (15 Points)

*Mô tả đóng góp cụ thể vào codebase VinWonders Agent (Next.js + AI SDK v6 + Ollama).*

### Modules implemented

| Module | Vai trò |
|--------|---------|
| `app/api/chat/route.ts` | API chat: policy, server tools, streaming, logging, chọn model Ollama |
| `lib/agent-tools.ts` | Nhận diện ý định + gọi `searchDestination` / `bookRestaurant` / `handleEmergency` |
| `lib/search.ts`, `lib/dedupe-destinations.ts` | Tìm địa điểm từ `mockData`, gom trùng khu (vd. Hải Vương) |
| `lib/booking.ts` | Đặt bàn demo, đọc ngữ cảnh từ lịch sử chat |
| `lib/agent-policy.ts`, `lib/agent-capabilities.ts`, `lib/fixed-reply.ts` | Guardrails, giới hạn token, từ chối off-topic, trả lời chức năng |
| `lib/memory/` | Context window + session memory summary |
| `lib/ollama-messages.ts` | Chuyển UIMessage → text cho Ollama (tránh lỗi format) |
| `lib/logging/` | Ghi `logs/metrics.jsonl`, rollup tool usage / latency / token |
| `components/chat/*` | UI chat, tool cards, form đặt bàn, **Agent Trace** panel |
| `app/api/models/route.ts` | Liệt kê model Ollama cho dropdown |

### Code highlights

**Luồng agent (model nhỏ, server-side tools)** — tương đương ReAct nhưng không dựa vào `Thought` text; routing bằng regex + thứ tự ưu tiên:

```typescript
// lib/agent-tools.ts — thứ tự: đặt bàn → y tế → mất đồ → gợi ý → tìm kiếm
if (isClearlyOffTopic(trimmed)) return null;
if (BOOKING_INTENT.test(lower)) return { name: 'bookRestaurant', input };
if (EXPLORATION_INTENT.test(lower)) return { name: 'searchDestination', input };
```

**Sau khi tool chạy**, API stream kết quả tool lên UI rồi gọi LLM chỉ để **tóm tắt** (observation → phản hồi):

```typescript
// app/api/chat/route.ts
writer.write({ type: 'tool-output-available', toolCallId, output });
const summary = streamText({ model: chatModel, system: `${system}\n\n${toolHint}\n\nKết quả...` });
// Chỉ merge chunk text — tránh trùng card tool trên UI
```

### Documentation (tương tác với “vòng ReAct”)

1. **User message** → `validateUserMessage` / `isCapabilitiesQuestion` / `isClearlyOffTopic` (policy, không gọi LLM).
2. **`detectServerTool`** → chọn tool → `runServerTool` (observation: JSON kết quả).
3. **`streamText`** với hint + kết quả tool → assistant text (bước “Answer” sau observation).
4. Model lớn hơn (`qwen2:7b`, …) có thể dùng **native tools** qua AI SDK (`buildAgentTools()`).

**Chatbot thuần**: khi không khớp tool và không policy → chỉ `streamText` với system prompt VinWonders, không có bước Action.

---

## II. Debugging Case Study (10 Points)

*Phân tích sự cố thật, có log trong `vinwonders-agent/logs/metrics.jsonl`.*

### Case A — Câu off-topic bị gợi ý phòng y tế (Iran)

- **Problem description**: Hỏi *"tình hình chiến sự iran"* → agent gợi ý **Phòng Y Tế Chữ Thập Đỏ** thay vì từ chối nhẹ.
- **Log source** (`metrics.jsonl`):
  - Trước sửa: `toolUsed: "searchDestination"`, `userMessagePreview: "tình hình chiến sự iran"` (request `58iAgj8BMVy8qYes`, ~1.6s).
  - Sau sửa: `toolUsed: "policy_off_topic"`, `finishReason: "policy"`, `latencyMs: 1` (request `dnGTpsfDjubUz21D`).
- **Diagnosis**:
  1. Regex `an\b` trong `SEARCH_FALLBACK` khớp đuôi từ **"ir`an`"** → kích hoạt tìm kiếm.
  2. Fallback tìm theo 4 ký tự **"tình"** trùng mô tả *"tình huống khẩn cấp"* trong contact y tế.
- **Solution**:
  - Bổ sung `OFF_TOPIC_PATTERNS` (chiến sự, Iran, tin tức…).
  - Xóa `an\b`, bỏ fallback tìm kiếm mơ hồ; `detectServerTool` gọi `isClearlyOffTopic` trước.
  - Cập nhật `OFF_TOPIC_REPLY` — không cung cấp tin thế giới.

### Case B — Lượt chat thứ 2 lỗi API (Ollama / OpenAI format)

- **Problem description**: Tin nhắn thứ hai báo lỗi (`item_reference` / invalid prompt) khi dùng history có tool parts.
- **Diagnosis**: Model `qwen2:1.5b` qua endpoint không tương thích message format AI SDK đầy đủ.
- **Solution**: `ollama.chat()` + `toOllamaMessages()` — flatten tool output thành text trong history; migrate AI SDK v6 (`@ai-sdk/react`, `convertToModelMessages`).

### Case C — Trùng ticket / trùng gợi ý địa điểm

- **Problem description**: Một câu trả lời hiện 2 card khẩn cấp hoặc 2 gợi ý cùng khu.
- **Solution**: `dedupeDestinations`, `dedupeToolPartsForRender`, stream text-only sau tool (không `merge` full UI stream).

**Rollup** (`logs/improvement-rollup.json`, 54 requests): `searchDestination` 16, `bookRestaurant` 10, `handleEmergency` 7, `policy_*` 5, `none` 16; **0 errors** logged.

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

*So sánh trong bối cảnh lab (Ollama local, VinWonders domain).*

### 1. Reasoning

Lab template dùng block `Thought`; implementation của em dùng **routing tường minh** + **observation JSON** thay vì để model 1.5B tự viết Thought/Action. Cách này ổn định hơn với model nhỏ: tool đúng trước, LLM chỉ diễn giải kết quả. Với model lớn (`supportsTools: true`), native tool loop gần ReAct hơn (model quyết định gọi tool).

So với chatbot thuần: agent path cho **hành động có cấu trúc** (mã ticket `VW-xxxx`, mã đặt bàn `VB-xxxxx`, danh sách địa điểm từ `mockData`) — không phụ thuộc hallucination.

### 2. Reliability — Agent kém hơn chatbot khi nào?

- **Câu mơ hồ / ngoài domain trước khi có policy**: dễ gọi nhầm tool (Iran → search y tế).
- **Model 1.5B tóm tắt sau tool**: đôi khi lan man hoặc `finishReason: "length"` (log `eRqsuUMBvS5Tmb6G`, ~18s) — chatbot ngắn đôi khi “đỡ phiền” hơn.
- **False positive khẩn cấp** (đã giảm): câu *"đề xuất chỗ chơi"* từng bị hiểu mất đồ — đã đổi thứ tự ưu tiên exploration trước emergency.
- **Ưu điểm agent**: đặt bàn có form xác nhận, trace tool bên phải, log metrics cho lab.

### 3. Observation (feedback môi trường)

Observation là output tool (danh sách nhà hàng, ticket, booking). Bước `streamText` tiếp theo nhận observation trong system string → câu trả lời bám dữ liệu hơn. **Agent Trace panel** giúp quan sát: `input` → `output` → `llm` / `policy`, hữu ích khi debug lab.

**Memory / context window**: khi chat dài, tin cũ bị prune nhưng summary giữ ticket/địa điểm — lượt sau vẫn nhắc được ngữ cảnh (đã test đặt bàn nhiều bước trong log).

---

## IV. Future Improvements (5 Points)

### Scalability

- Hàng đợi tool async (Redis/Bull) khi nhiều user; tách service search/booking khỏi Next API route.
- Retrieval địa điểm bằng vector DB thay vì `includes()` trên mock cố định.

### Safety

- Supervisor LLM hoặc rules engine audit trước `handleEmergency` / `bookRestaurant`.
- Rate limit + allowlist model; không expose Ollama trực tiếp ra internet.
- Policy layer mở rộng (PII, thanh toán thật) — hiện mới demo.

### Performance

- Cache kết quả search theo keyword; giảm gọi LLM tóm tắt bằng template cho tool output đơn giản.
- Model routing: intent nhẹ (1.5B) + summary chất lượng (7B) theo độ phức tạp.
- Theo dõi `metrics.jsonl` → dashboard (latency p95, tool error rate) — đã có rollup JSON làm nền.

---

## Tổng kết

Em xây dựng **VinWonders AI Agent** end-to-end: UI chat, 3 tools nghiệp vụ, guardrails, logging phục vụ lab, và panel **Agent Trace** để minh bạch luồng xử lý. Phần lớn thời gian lab dành cho **debug tích hợp Ollama + AI SDK** và **cân bằng chatbot vs tool-agent** trên model nhỏ — phù hợp bài học Lab 3 so sánh độ tin cậy hai paradigm.

---

> Đã nộp: `REPORT_HoangDucTruong.md` trong `report/individual_reports/`.
