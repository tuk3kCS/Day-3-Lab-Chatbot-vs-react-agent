# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: Nguyen Ho Dieu Linh
- **Student ID**: 2A202600567
- **Date**: 01-06-2026
- **Focus**: VinWonders Agent — anti-spam / anti-loop guardrails, response discipline (Karpathy-inspired), policy & routing hardening

---

## I. Technical Contribution (15 Points)

*Đóng góp chính vào codebase **vinwonders-agent/** (Next.js + AI SDK + Ollama + tooldoc.md + Group report).*

### Mô tả đóng góp

#### 1.1 Chống vòng lặp & spam lệnh / tool

- **Vấn đề:** Khi khách spam cùng intent (vd. “mất đồ”, suggestion nhanh), server routing (`detectServerTool`) gọi tool lặp → stream tool + LLM liên tục, gây cảm giác “vòng lặp vô hạn” và tạo ticket/booking trùng.
- **Giải pháp:**
  - Module **`vinwonders-agent/lib/tool-guard.ts`**: giới hạn gọi tool trùng, cooldown tool liên tiếp, đếm tool theo phiên.
  - **`evaluateConsecutiveSpamGuard`**: nếu cùng câu user lặp **3 lần liên tiếp** → **silent stream** (không thêm assistant message, không gọi LLM).
  - **Client** (`vinwonders-agent/app/page.tsx`): `sendLockRef` chống double-submit; chặn gửi lần thứ 3 + banner cooldown.
  - **Native tools** (`vinwonders-agent/app/api/chat/route.ts`): `stopWhen: stepCountIs(3)` (AI SDK) giới hạn vòng tool/LLM mỗi lượt.

#### 1.2 Sửa lỗi routing tool

- **`vinwonders-agent/lib/agent-tools.ts`:** Gộp `parseBookInput` + một `detectServerTool` duy nhất (trước đó duplicate `export` gây **build fail** Turbopack).

#### 1.3 Giới hạn phản hồi out-of-scope (Karpathy-inspired)

- Module **`vinwonders-agent/lib/karpathy-response-rules.ts`**: 4 nguyên tắc (suy nghĩ trước khi trả lời, đơn giản, surgical, tiêu chí hoàn thành) — nguồn [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).
- **`vinwonders-agent/lib/agent-policy.ts`:** `SCOPE_RULES` / `OFF_TOPIC_REPLY` rút gọn; `maxSentencesHint` mặc định **3**; thêm regex off-topic (giải thích lịch sử/thế giới, viết bài).
- System prompt ghép Karpathy qua `buildAgentSystemPrompt(memory, karpathyRules)`; tool summary hints surgical.

#### 1.4 Hạ tầng phản hồi policy

- **`vinwonders-agent/lib/fixed-reply.ts`:** `createSilentStreamResponse` cho spam lặp 3 lần.
- **`vinwonders-agent/lib/tool-trace.ts`:** nhãn trace cho policy tool trùng / spam.

---

### Modules Implemented

| Module | Vai trò |
|--------|---------|
| `vinwonders-agent/lib/tool-guard.ts` | `evaluateToolGuard`, `evaluateConsecutiveSpamGuard`, `countConsecutiveIdenticalUserMessages` |
| `vinwonders-agent/lib/karpathy-response-rules.ts` | `buildKarpathyResponseRules`, `buildKarpathyToolSummaryHint` |
| `vinwonders-agent/lib/agent-policy.ts` | `AGENT_LIMITS`, scope/off-topic, `buildAgentSystemPrompt` |
| `vinwonders-agent/lib/fixed-reply.ts` | Policy stream + silent stream |
| `vinwonders-agent/app/api/chat/route.ts` | Pipeline guard + `stepCountIs(3)` |
| `vinwonders-agent/app/page.tsx` | Client spam lock + hint UI |
| `vinwonders-agent/lib/agent-tools.ts` | Server-side tool detection (syntax fix) |

---

### Code Highlights

**Luồng xử lý request (`POST /api/chat`):**

```
validateUserMessage
  → evaluateConsecutiveSpamGuard (≥3 câu user giống → silent)
  → isCapabilitiesQuestion / isClearlyOffTopic (policy, không LLM)
  → detectServerTool + evaluateToolGuard
  → streamText (stopWhen: stepCountIs(3) nếu native tools)
```

**Spam guard (server):**

```typescript
// vinwonders-agent/lib/tool-guard.ts
export function evaluateConsecutiveSpamGuard(messages): ConsecutiveSpamGuardResult {
  const count = countConsecutiveIdenticalUserMessages(messages);
  if (count >= AGENT_LIMITS.maxConsecutiveDuplicateUserMessages) {
    return { allow: false, silent: true, consecutiveCount: count };
  }
  return { allow: true };
}
```

**Giới hạn vòng agent (native tools):**

```typescript
// vinwonders-agent/app/api/chat/route.ts
stopWhen: stepCountIs(AGENT_LIMITS.maxAgentToolSteps),
```

**Biến môi trường (tuỳ chọn):**

| Env | Mặc định | Ý nghĩa |
|-----|----------|---------|
| `MAX_CONSECUTIVE_DUPLICATE_USER` | 3 | Chặn silent sau N câu user giống nhau liên tiếp |
| `MAX_AGENT_TOOL_STEPS` | 3 | Tối đa vòng tool native |
| `MAX_SAME_TOOL_PER_SESSION` | 6 | Cap tool cùng tên / phiên |
| `MAX_RESPONSE_SENTENCES` | 3 | Gợi ý độ dài câu trả lời trong prompt |

---

### Documentation

| Tài liệu | Nội dung |
|----------|----------|
| [`tooldoc.md`](../../tooldoc.md) | Evolution **v2.1** — Guardrails & Response Discipline, bảng so sánh, env vars |
| [`GROUP_REPORT_Table_D1.md`](../group_report/GROUP_REPORT_Table_D1.md) | Báo cáo nhóm Table D1 — kiến trúc, telemetry, RCA, ablation |
| [`REPORT_HoangDucTruong.md`](REPORT_HoangDucTruong.md) | E2E VinWonders, tools, logging, debug Ollama/AI SDK |

**Tương tác với agent loop (VinWonders):** Khác ReAct Python (`Thought` → `Action` → `Observation`), VinWonders dùng **AI SDK tool loop** hoặc **server routing** (`detectServerTool` → tool stream → `streamText` tóm tắt). Guard được chèn **trước** vòng LLM/tool: policy/off-topic không vào loop; spam/tool guard giảm số vòng lặp và observation trùng.

**Tham chiếu ngoài:**

- [Karpathy guidelines](https://github.com/multica-ai/andrej-karpathy-skills)
- [AI SDK `stepCountIs`](https://ai-sdk.dev/docs/reference/ai-sdk-core/step-count-is)

---

## II. Debugging Case Study (10 Points)

### Problem Description

Khi spam suggestion **“Mất đồ khẩn cấp”** hoặc gửi liên tục cùng câu, agent gọi `handleEmergency` lặp → mỗi lần tạo ticket mới, UI tool cards chồng, stream không kết thúc rõ ràng. Build cũng **fail** tại `lib/agent-tools.ts` do hai lần `export function detectServerTool` lồng nhau.

### Log Source

- **Build:** Turbopack — `'import' and 'export' cannot be used outside of module code` tại `agent-tools.ts:123`.
- **Runtime / trace:** Tool Trace panel hiển thị nhiều bước `handleEmergency` / `searchDestination` liên tiếp cho cùng user text; metrics `toolUsed` lặp trong phiên.

### Diagnosis

1. **Routing:** `detectServerTool` khớp regex intent mỗi lần user gửi — không xét lịch sử hội thoại.
2. **Không có cap bước:** Server path gọi tool + summary mỗi request; client cho phép double-submit khi `status` chưa kịp `streaming`.
3. **Syntax:** Refactor `parseBookInput` để lại function `detectServerTool` bị duplicate — module parse lỗi.

### Solution

1. Sửa **`agent-tools.ts`** — một `detectServerTool` + `parseBookInput` riêng.
2. Thêm **`tool-guard.ts`** + pipeline trong **`route.ts`** (spam silent, tool cooldown).
3. **`page.tsx`:** `sendLockRef` + chặn lần gửi thứ 3; **`stopWhen: stepCountIs(3)`** cho native tools.
4. Karpathy rules + policy off-topic để giảm LLM trả lời dài / out-of-scope sau khi loop đã được kiểm soát.

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

1. **Reasoning:** ReAct (`src/agent/agent.py`) buộc model ghi `Thought` trước `Action` — dễ debug từng bước. VinWonders chatbot thường **một shot** hoặc **tool loop ẩn** (AI SDK); không có block `Thought` riêng nên khi lỗi khó thấy “vì sao” model chọn tool — Tool Trace panel bù phần nào.

2. **Reliability:** Agent **kém hơn** chatbot thuần khi: (a) model nhỏ + routing regex quá rộng → gọi tool sai intent; (b) spam → loop tool tốn thời gian hơn chatbot chỉ trả text cố định. Sau guardrails, agent ổn định hơn cho demo khẩn cấp/đặt bàn vì dữ liệu từ mock/tool chính xác hơn hallucination.

3. **Observation:** Feedback từ tool output (ticket, danh sách địa điểm) chi phối bước tóm tắt LLM tiếp theo — tương tự `Observation` trong ReAct. Nếu observation trùng (spam), bước sau lãng phí; guard cắt sớm tương đương “dừng loop khi không có thông tin mới”.

---

## IV. Future Improvements (5 Points)

- **Scalability:** Rate limit theo `sessionId` / IP trong `lib/guardrails.ts` (đã có skeleton) — gắn vào `/api/chat`; queue cho `handleEmergency` peak giờ cao điểm.

- **Safety:** Supervisor policy layer — audit tool args trước `execute`; không tạo ticket mới nếu ticket cùng loại đã mở trong 15 phút (server-side memory).

- **Performance:** Giữ `stepCountIs` + dedupe UI (`message-parts.ts`); cân nhắc thay silent stream bằng một dòng policy cố định để UX rõ hơn khi spam.

- **Documentation:** Hoàn thiện `tooldoc.md` v2.0 UI (map, form ảnh) khi có Figma; snapshot Tool Trace cho báo cáo lab.

---

## Kiểm thử đã thực hiện / đề xuất

1. Spam cùng suggestion 3 lần → lần 3: banner client + không phản hồi agent (silent).
2. Gửi 2 lần “mất ví…” → lần 2 có thể policy tool trùng; lần 3 bị chặn spam.
3. Hỏi off-topic → `OFF_TOPIC_REPLY` ngắn, không gọi tool.
4. `npm run build` trong `vinwonders-agent/` — pass sau khi sửa `agent-tools.ts`.

---

> **Phạm vi không đổi trong session:** UI Hybrid (mini-map, form ảnh GPS) vẫn theo spec `tooldoc.md` v2.0; logic spam/guard nằm ở v2.1.
