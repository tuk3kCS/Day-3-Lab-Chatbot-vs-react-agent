## 1. Tổng Quan Về Hệ Thống Tool - Current Tool Ecosystem

VinWonders AI Agent sử dụng hệ thống các công cụ cốt lõi sau để hỗ trợ du khách:

| Tool | Mô tả | File implementation |
|------|--------|----------------------|
| **searchDestination** | Tìm trò chơi, nhà hàng, show, khách sạn, tiện ích | `vinwonders-agent/lib/agent-tools.ts`, `search.ts` |
| **bookRestaurant** | Đặt bàn nhà hàng (demo lab) | `vinwonders-agent/lib/booking.ts` |
| **handleEmergency** | Mất đồ / y tế khẩn cấp — ticket + liên hệ | `vinwonders-agent/lib/agent-tools.ts` |

**Lớp bảo vệ (không phải tool UI):** `tool-guard.ts`, `agent-policy.ts`, `karpathy-response-rules.ts` — xem §2.1.

---

## 2. Chi Tiết Các Phiên Bản Tiến Hóa - Tool Spec Progression Log

### Phiên bản 1.0: Hỏi-Đáp AI (Pure Text-Based Q&A)

* **Mô tả kỹ thuật:** AI hoạt động hoàn toàn dựa trên luồng hội thoại dạng văn bản thô (Raw text responses). Khi du khách báo mất đồ hoặc tìm đường, AI phản hồi bằng các đoạn hướng dẫn dài chứa các bước thực hiện hoặc liệt kê danh sách địa danh.
* **Hạn chế & Điểm nghẽn:**
  * *Mật độ chữ quá cao, gợi ý thừa nhiều:* Du khách ở thực địa rất khó đọc hết các đoạn văn bản dài.
  * *Tỷ lệ Drop-out cao:* Quy trình báo mất đồ qua text tốn nhiều lượt chat (multi-turn).
  * *Khẩn cấp:* Thiếu form/ảnh/GPS — chỉ text + mã xác nhận đơn giản.

### Phiên bản 2.0: Hybrid & Tương tác (Hybrid & Interactive Component)

* **Mô tả kỹ thuật:** Generative AI + UI Components (Cards, Forms, Quick Actions) trong chat.
  * *Real-time / thời tiết / gợi ý địa điểm:* Routing `searchDestination` + cards.
  * *Báo mất đồ:* Quick Form + mã ticket (`handleEmergency`).
* **Cải tiến:** Visual-first, function calling + UI state (`tool-*` parts trong `UIMessage`), thêm tool-trace và chức năng lựa chọn model.

### Phiên bản 2.1: Guardrails & Response Discipline — *Phiên bản hiện tại (codebase)*

* **Mô tả kỹ thuật (đã triển khai):**
  * **Anti-spam / anti-loop:** Chặn gọi tool trùng (`evaluateToolGuard`); tối đa 3 vòng tool/LLM mỗi lượt (`stepCountIs(3)`); sau **3 câu user giống nhau liên tiếp** → silent stream (không trả lời assistant).
  * **Client:** Khóa gửi khi đang busy; banner cooldown khi spam lần 3.
  * **Out-of-scope:** Policy sớm (`isClearlyOffTopic`) + system prompt **Karpathy-inspired** (tối đa ~3 câu, surgical, từ chối ngoài VinWonders).
* **Rationale:** Giảm ticket/booking trùng, giảm chi phí LLM, giảm trả lời lan man / tin tức ngoài công viên.
* **Tài liệu kỹ thuật:** `report/group_report/GROUP_REPORT_Table_D1.md` (báo cáo nhóm), `report/individual_reports/REPORT_HoangDucTruong.md`, `report/individual_reports/REPORT_NguyenHoDieuLinh.md`.

---

## 3. BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT CHI TIẾT (TOOL SPEC EVOLUTION)

| Tính năng kỹ thuật | v1.0 (Text Q&A) | v2.0 (Hybrid UI) | v2.1 (Guardrails) | Lý do |
| :--- | :--- | :--- | :--- | :--- |
| **Giao diện phản hồi** | Text-only | Cards, Forms, Actions | Giữ 2.0 + banner spam | Mobile-first |
| **Luồng Báo mất đồ** | Multi-turn text | Quick Form + ticket | + Chặn lặp ticket khi spam | Khẩn cấp ổn định |
| **Luồng Tìm / Định vị** | Mô tả chữ | Map/embed (spec) | + Tool guard trên search | Tránh loop search |
| **Backend** | Text generation | Function calling + UI parts | + `tool-guard`, `stopWhen`, policy stream | Kiểm soát agent loop |
| **Độ dài câu trả lời** | Không giới hạn | Prompt ngắn cơ bản | Max ~3 câu + Karpathy rules | Out-of-scope / verbosity |
| **Spam cùng câu hỏi** | Không xử lý | Không xử lý | Silent sau 3 lần liên tiếp | UX + cost |
| **Off-topic** | LLM tự trả lời | Regex + policy một phần | Regex mở rộng + từ chối surgical | An toàn phạm vi |

---

## 4. Cấu hình vận hành (Environment)

| Biến | Mặc định | Mô tả |
|------|----------|--------|
| `MAX_CONSECUTIVE_DUPLICATE_USER` | 3 | Ngưỡng chặn silent spam |
| `MAX_AGENT_TOOL_STEPS` | 3 | Vòng tool native tối đa |
| `MAX_SAME_TOOL_PER_SESSION` | 6 | Cap tool / phiên |
| `MAX_RESPONSE_SENTENCES` | 3 | Gợi ý độ dài trong system prompt |
| `MAX_OUTPUT_TOKENS` | 320 | Cap token output chat |
| `MAX_OUTPUT_TOKENS_TOOL` | 180 | Cap sau khi gọi tool |

---

## 5. GỢI Ý TỐI ƯU SAU KHI CÓ BẢN DEMO UX/UI ĐẦY ĐỦ

1. **UI-to-Spec Mapping:** Chụp màn hình Form mất đồ, map, trạng thái Success/Error — gắn vào doc.
2. **Text Clipping Test:** Xác thực câu trả lời 3 câu / bullet trên mobile nhỏ.
3. **Edge Cases UI:** Mất mạng → bản đồ tĩnh offline (spec 2.0).
4. **Guardrails production:** Wire `lib/guardrails.ts` (rate limit IP/user) vào `/api/chat` nếu deploy thật.
5. **Spam UX:** Cân nhắc thay silent stream bằng một dòng policy cố định để khách hiểu vì sao im lặng.

---

## 6. Báo cáo (Reports)

| Báo cáo | Đường dẫn |
|---------|-----------|
| Tool spec & evolution (file này) | [`tooldoc.md`](tooldoc.md) |
| **Group report — Table D1** | [`report/group_report/GROUP_REPORT_Table_D1.md`](report/group_report/GROUP_REPORT_Table_D1.md) |
| Individual — E2E agent, logging, Agent Trace | [`report/individual_reports/REPORT_HoangDucTruong.md`](report/individual_reports/REPORT_HoangDucTruong.md) |
| Individual — guardrails v2.1, Karpathy rules | [`report/individual_reports/REPORT_NguyenHoDieuLinh.md`](report/individual_reports/REPORT_NguyenHoDieuLinh.md) |

> Nộp nhóm: đặt tên `GROUP_REPORT_[TEAM_NAME].md` trong `report/group_report/` (nhóm D1: `GROUP_REPORT_Table_D1.md`).
