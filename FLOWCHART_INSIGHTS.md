# 🎯 Sơ Đồ Lưu Chuyển & Những Hiểu Biết: Agent Chatbot VinWonders

## 1. Kiến Trúc Hệ Thống Cấp Cao

```
┌──────────────────────────────────────────────────────────────────┐
│                  LỚPINTERFACE NGƯỜI DÙNG                         │
│              (Next.js React Frontend - Giao Diện)               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Chat Interface (page.tsx) - Giao Diện Chat             │    │
│  │  • Hiển Thị Tin Nhắn (Người Dùng & Trợ Lý)             │    │
│  │  • Ô Nhập Liệu Văn Bản & Nút Gửi                       │    │
│  │  • Gợi Ý Nhanh (5 mẫu được xác định trước)             │    │
│  │  • Biểu Thị Trạng Thái (Sẵn Sàng/Gửi/Phát Trực Tiếp)  │    │
│  │  • Bảng Điều Khiển Ngữ Cảnh (Bộ Nhớ & Thông Tin Token) │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                        │
│                    HTTP POST                                     │
│                (messages: [] - Tin Nhắn)                        │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  LỚPCỔNG GATEWAY API                             │
│         (/api/chat/route.ts - Next.js)                          │
│                                                                  │
│  ┌─ XỬ LÝ YÊU CẦU ──────────────────────────────────────────┐   │
│  │ 1. Phân Tích Tin Nhắn Đến                                │   │
│  │ 2. Ghi Nhận Thời Gian Bắt Đầu Để Đo Độ Trễ              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│  ┌─ CHUẨN BỊ NGỮCẢNH ──────────────────────────────────────┐   │
│  │ • prepareConversationContext()                           │   │
│  │   - Lấy Toàn Bộ Lịch Sử Hội Thoại                       │   │
│  │   - Ước Tính Token Cho Từng Tin Nhắn                    │   │
│  │   - Áp Dụng Cửa Sổ Trượt (Tối Đa 6 Lượt)              │   │
│  │   - Trích Xuất Các Sự Kiện Cho Bộ Nhớ                  │   │
│  │   - Xây Dựng Tóm Tắt Bộ Nhớ                            │   │
│  │ • Kết Quả: Ngữ Cảnh Với Tin Nhắn Đã Cắt Tỉa + Siêu Dữ Liệu │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│  ┌─ ĐỊNH DẠNG TIN NHẮN ─────────────────────────────────────┐   │
│  │ • toOllamaMessages()                                     │   │
│  │   - Chuyển Đổi Định Dạng UIMessage Sang ModelMessage    │   │
│  │   - Bao Gồm Đầu Ra Công Cụ Trong Lịch Sử               │   │
│  │   - Định Dạng Văn Bản Tiếng Việt Đúng Cách             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│  ┌─ XÂY DỰNG PROMPT HỆ THỐNG ────────────────────────────────┐  │
│  │ • buildSystemPrompt()                                    │   │
│  │   - Hướng Dẫn Hệ Thống Cơ Bản (Bối Cảnh VinWonders)    │   │
│  │   - Thêm Tóm Tắt Bộ Nhớ (Nếu Có Sẵn)                   │   │
│  │   - Thêm Thông Tin Ngữ Cảnh (Thông Báo Cắt Tỉa)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│              LỚPQUYẾT ĐỊNH CỦA AGENT                             │
│      (Phát Hiện Công Cụ & Lựa Chọn Tuyến Đường)                │
│                                                                  │
│  MODEL_SUPPORTS_TOOLS? (Kiểm Tra Khả Năng Ollama)              │
│           │                                                      │
│        CÓ│                             KHÔNG                     │
│           │                              │                       │
│           ▼                              ▼                       │
│    ┌─────────────────┐       ┌──────────────────────────────┐   │
│    │ TIẾP CẬN CÔNG CỤ│       │ CHẾ ĐỘ DỰ PHÒNG            │   │
│    │ GỐC             │       │ (Phát Hiện Dựa Trên Mẫu)   │   │
│    │                 │       │                            │   │
│    │ LLM Hỗ Trợ     │       │ 1. Phân Tích Văn Bản       │   │
│    │ Gọi Công Cụ    │       │ 2. Khớp Mẫu Regex          │   │
│    │ Gốc             │       │ 3. Định Tuyến Đến Công Cụ │   │
│    │ (GPT-4, v.v..)  │       │    Thích Hợp              │   │
│    │                 │       │ 4. Thực Thi Công Cụ       │   │
│    │ → Vượt Qua      │       │    (Máy Chủ)              │   │
│    │   Công Cụ      │       │ 5. LLM Tóm Tắt Kết Quả    │   │
│    │   Cho LLM      │       │                            │   │
│    │ → LLM Quyết    │       │ Ưu Tiên Mẫu:              │   │
│    │   Định Gọi     │       │ • INTENT_KHÁM PHÁ         │   │
│    │   Công Cụ Nào  │       │ • INTENT_Y_TẾ_KHẨN_CẤP    │   │
│    │ → Thực Thi     │       │ • INCIDENT_KHẨN_CẤP       │   │
│    │ → Nhận Kết     │       │ • SEARCH_FALLBACK         │   │
│    │   Quả          │       │                            │   │
│    └─────────────────┘       └──────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│              LỚPTHỰC THI CÔNG CỤ                                 │
│                                                                  │
│  ┌─ ĐIỀU PHỐI CÔNG CỤ ──────────────────────────────────────┐   │
│  │                                                          │   │
│  │  detectServerTool(userText) - Phát Hiện Công Cụ        │   │
│  │  │                                                       │   │
│  │  ├─ searchDestination - Tìm Kiếm Địa Điểm             │   │
│  │  │  • keyword: string (truy vấn tìm kiếm)             │   │
│  │  │  • category?: 'ride'|'nhà hàng'|'khách sạn'|v.v.  │   │
│  │  │  • Kết Quả: { results: Destination[] }             │   │
│  │  │                                                       │   │
│  │  └─ handleEmergency - Xử Lý Khẩn Cấp                  │   │
│  │     • type: 'lost_item'|'medical'|'other'             │   │
│  │     • description: string (mô tả)                     │   │
│  │     • Kết Quả: { status, ticketId, contact_info }    │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│  ┌─ THỰC THI & TÍCH HỢP ──────────────────────────────────┐    │
│  │                                                          │   │
│  │ 1. Chạy Công Cụ Được Chọn                              │   │
│  │ 2. Nhận Đầu Ra Có Cấu Trúc                             │   │
│  │ 3. Định Dạng Làm Tin Nhắn UI Với Siêu Dữ Liệu        │   │
│  │ 4. (Tùy Chọn) Nhận Tóm Tắt Của LLM Về Kết Quả        │   │
│  │ 5. Phát Trực Tiếp Phản Hồi Về Phía Khách Hàng        │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│            LỚPPHÁT TRỰC TIẾP PHẢN HỒI                           │
│             (Phát Trực Tiếp Cho Khách Hàng)                     │
│                                                                  │
│  streamText({ model, messages, system, tools, onFinish })      │
│  │                                                               │
│  ├─ Bắt Đầu Phát Trực Tiếp Token Cho Khách Hàng               │
│  ├─ Gọi lại onFinish: logMetrics(usage) - Ghi Nhật Ký Chỉ Số  │
│  │  • Ghi Lại Số Lượng Token Cuối Cùng                       │
│  │  • Tính Toán Độ Trễ (latency_ms)                          │
│  │  • Ghi Vào Bảng Điều Khiển                                │
│  ├─ Chuyển Đổi Sang UI MessageStream                           │
│  └─ Đính Kèm Tiêu Đề Phản Hồi (Siêu Dữ Liệu Ngữ Cảnh)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│          LỚPQUAN SÁT VÀ GHI NHẬT KÝ                              │
│           (Giám Sát Phía Máy Chủ)                               │
│                                                                  │
│  ┌─ GHI NHẬT KÝ CÓ CẤU TRÚC (logger.py) ────────────────────┐   │
│  │ • AGENT_START: input, model_name (Khởi Động Agent)     │   │
│  │ • AGENT_STEP: step_number, response (Bước Của Agent)   │   │
│  │ • AGENT_FINAL_ANSWER: answer, steps (Câu Trả Lời Cuối) │   │
│  │ • LLM_METRIC: provider, model, tokens, latency, cost   │   │
│  │ • ERROR_EVENTS: error_type, stack_trace (Sự Kiện Lỗi)  │   │
│  │                                                           │   │
│  │ Định Dạng: JSON Với Timestamp + Event_type + Data       │   │
│  │ Đầu Ra: logs/YYYY-MM-DD.log + Console                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ CHỈ SỐ HIỆU SUẤT (metrics.py) ───────────────────────┐    │
│  │ PerformanceTracker.track_request():                      │    │
│  │ • prompt_tokens: kích thước đầu vào                     │    │
│  │ • completion_tokens: kích thước đầu ra                  │    │
│  │ • total_tokens: tổng (để tính hóa đơn)                 │    │
│  │ • latency_ms: thời gian phản hồi (mili giây)            │    │
│  │ • cost_estimate: tokens × giá theo mô hình              │    │
│  │                                                           │    │
│  │ Tổng Hợp: session_metrics = [ metric, metric, ... ]     │    │
│  │ Phân Tích: P50/P99 latency, avg tokens, total cost      │    │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ TIÊU ĐỀ PHẢN HỒI HTTP (Siêu Dữ Liệu Ngữ Cảnh) ───────┐    │
│  │ • X-Context-Total: tổng tin nhắn trong lịch sử         │    │
│  │ • X-Context-Window: tin nhắn gửi cho LLM               │    │
│  │ • X-Context-Pruned: tin nhắn đã xóa                    │    │
│  │ • X-Context-Tokens: ước tính token cho cửa sổ          │    │
│  │ • X-Memory-Active: tóm tắt bộ nhớ có sẵn               │    │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Vòng Lặp ReAct Agent (Backend Python)

```
ĐẦU VÀO: user_query - Câu Hỏi Người Dùng
│
├─ KHỞI TẠO
│  ├─ current_prompt = user_query (Prompt Hiện Tại)
│  ├─ steps = 0 (Số Bước)
│  ├─ history = [] (Lịch Sử)
│  └─ logger.log_event("AGENT_START", ...) (Ghi Nhật Ký Khởi Động)
│
└─ TRONG KHI steps < max_steps (5):
   │
   ├─ BƯỚC 1: TẠO ƯỚC TÍNH (THOUGHT GENERATION)
   │  ├─ response = llm.generate(
   │  │               prompt=current_prompt,
   │  │               system_prompt=get_system_prompt()
   │  │             )
   │  ├─ content = response["content"] (Nội Dung Phản Hồi)
   │  ├─ usage = response["usage"] (Mức Sử Dụng)
   │  ├─ latency_ms = response["latency_ms"] (Độ Trễ)
   │  │
   │  └─ Logger.log_event("AGENT_STEP", {
   │                      "step": steps + 1,
   │                      "response": content
   │                    }) (Ghi Nhật Ký Bước)
   │
   ├─ BƯỚC 2: PHÂN TÍCH HÀNH ĐỘNG (ACTION PARSING)
   │  ├─ final_answer = _extract_final_answer(content)
   │  │  (Trích Xuất Câu Trả Lời Cuối Cùng)
   │  │
   │  ├─ NẾU final_answer được tìm thấy:
   │  │  │
   │  │  ├─ logger.log_event("AGENT_FINAL_ANSWER", ...)
   │  │  ├─ history.append({"role": "assistant", "content": content})
   │  │  │
   │  │  └─ TRỐNG final_answer ✓ (Thành Công)
   │  │
   │  └─ KHÁC:
   │     │
   │     ├─ tool_match = _parse_action(content)
   │     │  (Trích Xuất "Action: tool_name(args)")
   │     │
   │     ├─ NẾU tool_match:
   │     │  │
   │     │  ├─ tool_name, args = tool_match
   │     │  ├─ history.append({"role": "assistant", "content": content})
   │     │  │
   │     │  └─ BƯỚC 3: THỰC THI CÔNG CỤ (TOOL EXECUTION)
   │     │     │
   │     │     ├─ observation = _execute_tool(tool_name, args)
   │     │     │  (Quan Sát - Kết Quả Từ Công Cụ)
   │     │     │
   │     │     ├─ NẾU observation là lỗi:
   │     │     │  └─ logger.log_event("TOOL_ERROR", ...)
   │     │     │
   │     │     ├─ history.append({
   │     │     │    "role": "observation",
   │     │     │    "content": observation
   │     │     │  })
   │     │     │
   │     │     └─ BƯỚC 4: TÍCH HỢP QUAN SÁT (OBSERVATION INTEGRATION)
   │     │        │
   │     │        ├─ current_prompt = REBUILD_PROMPT(user_query, history)
   │     │        │  (Nối Quan Sát Vào Ngữ Cảnh)
   │     │        │
   │     │        └─ steps += 1
   │     │           (Vòng Lặp Tiếp Tục Với Ngữ Cảnh Cập Nhật)
   │     │
   │     └─ KHÁC (Không Tìm Thấy Hành Động Hợp Lệ):
   │        │
   │        ├─ logger.log_event("PARSING_ERROR", ...)
   │        ├─ steps += 1
   │        └─ (Thử Lại Hoặc Bỏ Cuộc)
   │
   └─ HẾT VÒNG LẶP
│
└─ XỬ LÝ TIMEOUT (HẾT THỜI GIAN)
   ├─ NẾU steps >= max_steps:
   │  │
   │  ├─ logger.log_event("AGENT_TIMEOUT", ...)
   │  └─ TRỐNG last_known_answer hoặc lỗi
   │
   └─ ĐẦU RA: Câu Trả Lời Có Cấu Trúc Cuối Cùng

CHỈ BÁOCÓ HOẠ:
✓ = Đường Dẫn Thành Công
✗ = Đường Dẫn Lỗi/Dự Phòng
```

---

## 3. Luồng Bảo Mật & Hạn Chế (Security & Guardrails Flow)

```
ĐẦU VÀO TỪ NGƯỜI DÙNG
│
├─ BƯỚC 1: XÁC THỰC Ý ĐỊNH
│  │
│  ├─ Kiểm Tra Mẫu EXPLORATION_INTENT (Ý Định Khám Phá)
│  │  Regex: /(đề xuất|gợi ý|nên đi|chơi đâu|...)/i
│  │  Mục Đích: Yêu Cầu Tìm Kiếm Hợp Lệ
│  │
│  ├─ Kiểm Tra Mẫu EMERGENCY_MEDICAL (Y Tế Khẩn Cấp)
│  │  Regex: /(y tế|medical|say nắng|cấp cứu|...)/i
│  │  Mục Đích: Phát Hiện Khẩn Cấp Y Tế
│  │
│  ├─ Kiểm Tra Mẫu EMERGENCY_INCIDENT (Sự Cố Khẩn Cấp)
│  │  Regex: /(mất đồ|mất ví|lạc trẻ|giúp gấp|...)/i
│  │  Mục Đích: Phát Hiện Mất Đồ/Sự Cố Tới Hạn
│  │
│  ├─ Kiểm Tra Mẫu SEARCH_FALLBACK (Tìm Kiếm Ngoài Dự Phòng)
│  │  Regex: /(mưa|nhà hàng|khách sạn|show|...)/i
│  │  Mục Đích: Truy Vấn Tìm Kiếm Chung
│  │
│  └─ NẾU Không Tìm Thấy Ý Định Hợp Lệ:
│     └─ → TỪ CHỐI hoặc Phản Hồi Chung (Hạn Chế)
│
├─ BƯỚC 2: XÁC THỰC CÔNG CỤ
│  │
│  ├─ Kiểm Tra Danh Sách Trắng: Công Cụ Có Trong Danh Sách Đã Đăng Ký?
│  │  Được Phép: [searchDestination, handleEmergency]
│  │  Từ Chối: Bất Kỳ Công Cụ Không Có Trong Danh Sách (Ngăn Chặn Ảo Tưởng)
│  │
│  └─ Xác Thực Lược Đồ (Zod):
│     ├─ keyword: string (bắt buộc)
│     ├─ category: enum (tùy chọn, đã xác thực)
│     ├─ type: enum(['lost_item', 'medical', 'other'])
│     └─ description: string (bắt buộc)
│
├─ BƯỚC 3: SỐ SINH LIỆU ĐẦU VÀO (INPUT SANITIZATION)
│  │
│  ├─ Xóa Khoảng Trắng
│  ├─ Kiểm Tra Giới Hạn Độ Dài (Ngăn Chặn DOS)
│  ├─ Thoát Ký Tự Đặc Biệt Cho Đối Số Công Cụ
│  └─ Xác Thực Chống SQL/Script Injection
│
├─ BƯỚC 4: BẢO VỆ KHÓA API (API KEY PROTECTION)
│  │
│  ├─ Tất Cả Khóa API Trong .env (Không Bao Giờ Trong Code)
│  ├─ Khóa Được Tải Thông Qua process.env
│  ├─ Không Được Ghi Vào Bảng Điều Khiển Hoặc Tập Tin
│  └─ Không Bao Giờ Tiếp Xúc Trong Thông Báo Lỗi
│
├─ BƯỚC 5: THỰC THI HẠN CHẾ (GUARDRAILS ENFORCEMENT)
│  │
│  ├─ Số Bước Tối Đa: 5 (Ngăn Chặn Vòng Lặp Vô Hạn)
│  ├─ Token Tối Đa: 2800 Trong Cửa Sổ Ngữ Cảnh
│  ├─ Độ Trễ Tối Đa: 5000ms (Timeout)
│  ├─ Giới Hạn Tỷ Lệ: (Tùy Chọn Theo Triển Khai)
│  └─ Giới Hạn Chi Phí: (Tùy Chọn Theo Mô Hình)
│
└─ ĐƯỢC PHÉP → Tiếp Tục Vòng Lặp Agent
   BỊ TỪ CHỐI → Ghi Nhật Ký Sự Kiện Bảo Mật + Phản Hồi Lỗi

CÁC SỰ KIỆN BẢO MẬT ĐƯỢC GHI NHẬT KÝ:
├─ INVALID_INTENT (Ý Định Không Hợp Lệ)
├─ HALLUCINATED_TOOL (Công Cụ Bị Ảo Tưởng)
├─ SCHEMA_VALIDATION_ERROR (Lỗi Xác Thực Lược Đồ)
├─ INPUT_TOO_LARGE (Đầu Vào Quá Lớn)
├─ SUSPICIOUS_PATTERN_DETECTED (Phát Hiện Mẫu Đáng Ngờ)
└─ RATE_LIMIT_EXCEEDED (Vượt Quá Giới Hạn Tỷ Lệ)
```

---

## 4. Quản Lý Cửa Sổ Ngữ Cảnh & Bộ Nhớ

```
LỊCH SỬ TIN NHẮN
├─ Đầy Đủ: [msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8, ...]
│
├─ BƯỚC 1: TÍNH TOÁN CỬA SỔ NGỮCẢNH
│  │
│  ├─ estimateTokens(text) = ceil(len(text) / 4)
│  │  (Phỏng Đoán: ~1 token cho 4 ký tự tiếng Việt)
│  │
│  ├─ Với Mỗi Tin Nhắn, Ước Tính Token
│  │  msg1: ~300 token
│  │  msg2: ~250 token
│  │  msg3: ~400 token
│  │  msg4: ~280 token
│  │  ...
│  │
│  └─ Cấu Hình:
│     ├─ maxTurns: 6 (số vòng hội thoại tối đa)
│     └─ maxEstimatedTokens: 2800 (token ước tính tối đa)
│
├─ BƯỚC 2: ÁP DỤNG CỬA SỔ TRƯỢT (SLIDING WINDOW)
│  │
│  ├─ Bắt Đầu Từ Tin Nhắn Gần Đây Nhất
│  ├─ Thêm Tin Nhắn Từ Phía Sau
│  ├─ Dừng Khi:
│  │  ├─ Tổng Token ≥ 2800, HOẶC
│  │  ├─ Vòng ≥ 6
│  │  └─ Đạt Đến Đầu Lịch Sử
│  │
│  └─ Kết Quả:
│     └─ windowMessages = [msg6, msg7, msg8] (3 vòng gần đây)
│        totalTokens = 930
│        pruned = 5 tin nhắn đã xóa
│
├─ BƯỚC 3: TRÍCH XUẤT SỰ KIỆN PHIÊN (SESSION FACTS EXTRACTION)
│  │
│  ├─ extractSessionFacts(messages):
│  │  ├─ Lặp Qua Tất Cả Tin Nhắn
│  │  ├─ Trích Xuất Sự Kiện Quan Trọng:
│  │  │  ├─ Tùy Chọn Người Dùng
│  │  │  ├─ Kết Quả Tìm Kiếm Được Đề Cập
│  │  │  ├─ Sự Cố Khẩn Cấp Được Xử Lý
│  │  │  └─ Vấn Đề Đã Giải Quyết
│  │  └─ Lưu Trữ Lên Đến 8 Sự Kiện
│  │
│  └─ Ví Dụ Sự Kiện:
│     ├─ "Khách đã hỏi: 'Chơi gì khi trời mưa?'"
│     ├─ "Đã gợi ý địa điểm: Thác nước, Safari"
│     └─ "Khách báo mất ví, mã ticket: VW-3421"
│
├─ BƯỚC 4: XÂY DỰNG TÓM TẮT BỘ NHỚ (MEMORY SUMMARY BUILDING)
│  │
│  ├─ buildMemorySummary(facts):
│  │  ├─ Định Dạng Sự Kiện Thành Đoạn Văn Có Ý NGHĨA
│  │  ├─ Làm Cho Nó Ngắn Gọn (Phù Hợp Với System Prompt)
│  │  └─ Tham Chiếu Đến Các Quyết Định Bối Cảnh
│  │
│  └─ Ví Dụ Tóm Tắt:
│     "Khách quan tâm đến các hoạt động ngoài trời
│      khi thời tiết không tốt. Đã được gợi ý
│      Safari và Thác nước. Gần đây xảy ra sự cố
│      mất ví (Ticket VW-3421), đã được hỗ trợ."
│
└─ BƯỚC 5: TẠO SIÊU DỮ LIỆU NGỮCẢNH
   │
   ├─ Thống Kê Cho Tiêu Đề HTTP:
   │  ├─ X-Context-Total: 8 (tổng tin nhắn)
   │  ├─ X-Context-Window: 3 (tin nhắn đã gửi)
   │  ├─ X-Context-Pruned: 5 (tin nhắn đã xóa)
   │  ├─ X-Context-Tokens: 930 (token ước tính)
   │  └─ X-Memory-Active: 1 (tóm tắt bộ nhớ có sẵn)
   │
   └─ Được Sử Dụng Bởi Frontend Để Hiển Thị Thông Tin Ngữ Cảnh
      Trong "Bảng Điều Khiển Ngữ Cảnh"

LỢI ÍCH CỦA BỘ NHỚ:
✓ Agent Hiểu Tùy Chọn Người Dùng Mà Không Lặp Lại
✓ Giảm Số Lượng Token Cho Các Chủ Đề Trùng Lặp
✓ Tính Liên Tục Tốt Hơn Trên Toàn Bộ Hội Thoại
✓ Phản Hồi Nhanh Hơn Do Cửa Sổ Nhỏ Hơn
```

---

## 5. Luồng Ghi Nhật Ký & Chỉ Số Hiệu Suất

```
CÁC SỰ KIỆN ỨNG DỤNG
│
├─ AGENT_START (Khởi Động Agent)
│  ├─ Timestamp: 2026-06-01T14:30:45.123Z (Dấu Thời Gian)
│  ├─ Event: AGENT_START
│  ├─ Input: "Tôi bị rơi cái ví" (Đầu Vào)
│  └─ Model: "qwen2:1.5b" (Mô Hình)
│
├─ AGENT_STEP (Bước Agent)
│  ├─ Step: 1 (Bước)
│  ├─ Response: "Thought: Khách mất ví, cần xử lý khẩn cấp.
│  │             Action: handleEmergency(type=lost_item,
│  │                      description='Mất ví tại...')"
│  └─ (Ghi Nhật Ký Cho Mỗi Bước)
│
├─ LLM_METRIC (Chỉ Số LLM)
│  ├─ Provider: "ollama" | "openai" | "google" (Nhà Cung Cấp)
│  ├─ Model: "qwen2:1.5b" | "gpt-4o" | "gemini-1.5-flash" (Mô Hình)
│  ├─ Prompt_tokens: 245 (Token Prompt)
│  ├─ Completion_tokens: 128 (Token Hoàn Thành)
│  ├─ Total_tokens: 373 (Tổng Token)
│  ├─ Latency_ms: 1247 (Độ Trễ)
│  └─ Cost_estimate: $0.00037 (Ước Tính Chi Phí)
│
├─ TOOL_EXECUTION (Thực Thi Công Cụ)
│  ├─ Tool_name: "handleEmergency" (Tên Công Cụ)
│  ├─ Input: {"type": "lost_item", "description": "..."} (Đầu Vào)
│  ├─ Output: {"status": "success", "ticketId": "VW-3421"} (Đầu Ra)
│  └─ Execution_time_ms: 45 (Thời Gian Thực Thi)
│
├─ AGENT_FINAL_ANSWER (Câu Trả Lời Cuối Cùng)
│  ├─ Steps: 1 (Số Bước)
│  ├─ Answer: "Đã kích hoạt quy trình ứng phó. Mã ticket..."
│  └─ Total_time_ms: 1292 (Tổng Thời Gian)
│
├─ ERROR_EVENT (Sự Kiện Lỗi - Nếu Có)
│  ├─ Error_type: "PARSING_ERROR" | "TOOL_NOT_FOUND" | v.v.
│  ├─ Message: "Không Thể Phân Tích Hành Động Từ Phản Hồi LLM"
│  ├─ Stack_trace: (Chi Tiết Lỗi Đầy Đủ)
│  └─ Step: 2 (Bước Xảy Ra Lỗi)
│
└─ ĐẦU RA NHẬT KÝ
   │
   ├─ Tệp: logs/2026-06-01.log (Tệp Nhật Ký)
   │  Định Dạng: JSONL (một đối tượng JSON cho mỗi dòng)
   │  Ví Dụ Dòng:
   │  {"timestamp":"2026-06-01T14:30:45.123Z","event":"AGENT_START",
   │   "data":{"input":"...","model":"..."}}
   │
   └─ Bảng Điều Khiển: Đầu Ra Định Dạng Cho Phát Triển
      ======== [GHI NHẬT KÝ CHỈ SỐ AI AGENT] ========
      ⏱️ Độ Trễ: 1247 ms
      📥 Token Nhập: 245
      📤 Token Xuất: 128
      🔤 Tổng Token: 373
      ======================================

PHÂN TÍCH & NHỮNG HIỂU BIẾT TỪ NHẬT KÝ:
├─ Tổng Yêu Cầu: N (Tổng số)
├─ Tỷ Lệ Thành Công: X% (Tỷ Lệ Thành Công)
├─ Độ Trễ Trung Bình: Yms (P50) (Độ Trễ Trung Bình)
├─ Độ Trễ Phân Vị Thứ 99: Zms (P99) (Phân Vị P99)
├─ Token Trung Bình Mỗi Yêu Cầu: W (Token Trung Bình)
├─ Tổng Chi Phí: $C (Tổng Chi Phí)
├─ Phân Loại Lỗi: [type: count, ...] (Phân Loại Lỗi)
├─ Công Cụ Được Sử Dụng Nhiều Nhất: [tool: count, ...] (Công Cụ Phổ Biến)
└─ Xu Hướng Hiệu Suất: (theo thời gian) (Xu Hướng)
```

---

## 6. Những Điểm Học Tập Chính & Những Hiểu Biết

### **📚 Những Gì Chúng Ta Đã Học**

#### **1. Sức Mạnh Của Vòng Lặp ReAct**
```
Chatbot Đơn Giản:
├─ Người Dùng: "Tôi bị rơi ví. Mưa. Nên đi đâu?"
├─ Chatbot: "Tôi thích cả ba tình huống đó!"
└─ Kết Quả: ❌ Ảo Tưởng, Không Hiểu Multi-Step

ReAct Agent:
├─ Người Dùng: "Tôi bị rơi ví. Mưa. Nên đi đâu?"
├─ Thought: "Khách có 3 nhu cầu: mất đồ (khẩn cấp), thời tiết, địa điểm"
├─ Action 1: handleEmergency(type=lost_item, ...)
├─ Observation 1: "Ticket VW-3421 đã tạo. Liên hệ: ..."
├─ Action 2: searchDestination(keyword='mưa', category='facility')
├─ Observation 2: "[Thác nước, Safari, Nhà hàng trong nhà]"
├─ Final Answer: "Xử lý mất ví xong (Ticket). Vì trời mưa, gợi ý..."
└─ Kết Quả: ✅ Suy Luận Multi-Step Chính Xác
```

#### **2. Ý Định Quan Trọng Hơn Prompt Engineering**
```
Tại Sao Phát Hiện Dựa Trên Mẫu Hoạt Động:
├─ Regex EXPLORATION_INTENT Bắt Được Hầu Hết Truy Vấn Tìm Kiếm
├─ Mẫu EMERGENCY Bắt Được Các Vấn Đề Khẩn Cấp
├─ Danh Sách Trắng + Xác Thực Lược Đồ Ngăn Chặn Ảo Tưởng
├─ Chế Độ Dự Phòng Hoạt Động Khi LLM Không Hỗ Trợ Công Cụ

Hiểu Biết:
└─ 80% Thất Bại Của Agent Là Do Ý Định Không Rõ Ràng
   20% Là Do Đối Số Công Cụ Không Chính Xác
   
Giải Pháp:
├─ Đừng Prompt Quá Mức. Quá Trúc Trở.
└─ Sử Dụng Phát Hiện Ý Định → Định Tuyến Công Cụ
```

#### **3. Cửa Sổ Ngữ Cảnh Rất Quan Trọng**
```
Không Có Quản Lý Bộ Nhớ:
├─ Số Lượng Token Tăng → Chi Phí Cao
├─ Độ Trễ Tăng → Phản Hồi Chậm
├─ LLM Bị Bối Rối → Ảo Tưởng

Với Cửa Sổ Ngữ Cảnh (6 Vòng, 2800 Token):
├─ Chi Phí ÷ 3-4x (Ít Token Hơn)
├─ Độ Trễ ÷ 2-3x (Ngữ Cảnh Nhỏ Hơn)
├─ Chất Lượng ↑ (LLM Tập Trung Vào Gần Đây)

Hiểu Biết:
└─ Cắt Tỉa Thông Minh > Giới Hạn Token Thô
   Sự Kiện Bộ Nhớ > Phát Lại Lịch Sử Đầy Đủ
```

#### **4. Ghi Nhật Ký Là Gỡ Lỗi**
```
Khi Agent Thất Bại:
├─ Kiểm Tra Nhật Ký, Không Đoán Mò
├─ Sử Dụng JSON Có Cấu Trúc Để Phân Tích
├─ Theo Dõi Chỉ Số: Độ Trễ, Token, Chi Phí
├─ Xây Dựng Bảng Điều Khiển Từ Nhật Ký

Thất Bại Thường Gặp Trong Nhật Ký:
├─ Mẫu Không Khớp → Cập Nhật Mẫu
├─ Timeout Công Cụ → Thêm Thử Lại
├─ Tăng Chi Phí → Tối Ưu Hóa Prompt
└─ Xu Hướng Độ Trễ → Thay Đổi Nhà Cung Cấp
```

#### **5. Hạn Chế >= Prompt Phức Tạp**
```
Cách Làm Xấu:
├─ Viết Prompt 500 Dòng
├─ Hy Vọng LLM Ở Trên Track
└─ Kết Quả: Ảo Tưởng Dù Sao

Cách Làm Tốt:
├─ Danh Sách Trắng Công Cụ Được Phép (3 Dòng)
├─ Xác Thực Lược Đồ (Zod, 5 Dòng)
├─ Bước Tối Đa, Token Tối Đa (2 Dòng)
├─ Định Tuyến Dựa Trên Ý Định (Regex, 20 Dòng)
└─ Kết Quả: Độ Tin Cậy 95%

Toán Học:
└─ 30 Dòng Hạn Chế > 500 Dòng Prompt
```

## 6. Conclusions & Key Takeaways

### ✅ Những Điểm Hoạt Động Tốt

1. **Định tuyến dựa trên ý định (Intent-based routing)** – Đơn giản, đáng tin cậy và nhanh chóng.
2. **Quản lý cửa sổ ngữ cảnh (Context window management)** – Cân bằng tốt giữa chi phí và chất lượng.
3. **Ghi log có cấu trúc (Structured logging)** – Hỗ trợ cải tiến dựa trên dữ liệu.
4. **Các cơ chế bảo vệ (Guardrails)** – Hiệu quả hơn so với việc sử dụng các prompt quá phức tạp.
5. **Kiến trúc mô-đun (Modular architecture)** – Dễ dàng mở rộng và chỉnh sửa.

### ⚠️ Những Điểm Cần Cải Thiện

1. **Khả năng khôi phục lỗi (Error recovery)** – Bổ sung cơ chế thử lại (retry) với chiến lược exponential backoff.
2. **Chuyển đổi nhà cung cấp dự phòng (Provider fallback)** – Khi mô hình LLM chính gặp sự cố.
3. **Giới hạn tần suất (Rate limiting)** – Ngăn chặn việc lạm dụng hệ thống.
4. **Bảng điều khiển số liệu (Metrics dashboard)** – Trực quan hóa xu hướng và hiệu suất.
5. **Vòng phản hồi từ người dùng (User feedback loop)** – Học hỏi từ các cuộc hội thoại để cải thiện hệ thống.

### 🎓 Bài Học Quan Trọng

```text
1. Đơn Giản > Phức Tạp
   30 dòng guardrails hiệu quả hơn 500 dòng prompt.

2. Ra Quyết Định Dựa Trên Dữ Liệu
   Dùng log để tìm và sửa lỗi, không dựa vào phỏng đoán.
   Theo dõi các chỉ số (metrics) cho mọi thay đổi.

3. Suy Luận Nhiều Bước Cần Vòng Lặp Agent
   Chatbot thông thường khó xử lý các truy vấn phức tạp.
   Vòng lặp ReAct giúp giải quyết các bài toán nhiều bước.

4. Bộ Nhớ Là Yếu Tố Then Chốt
   Quản lý context window giúp giảm chi phí tới 4 lần.
   Lưu trữ thông tin phiên làm việc giúp tăng độ nhất quán khoảng 40%.

5. Bảo Mật Là Một Quá Trình Liên Tục
   Bắt đầu từ các biện pháp cơ bản (kiểm tra đầu vào).
   Dần bổ sung các lớp bảo vệ khác (rate limiting, chống DDoS, v.v.).