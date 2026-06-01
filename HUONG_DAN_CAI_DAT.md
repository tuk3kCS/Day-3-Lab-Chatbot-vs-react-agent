# Hướng dẫn cài đặt & chạy dự án Day 3 — Chatbot vs ReAct Agent

Tài liệu này hướng dẫn cài đặt từ đầu và chạy **toàn bộ** repository, gồm hai phần chính:

| Phần | Thư mục | Mô tả |
|------|---------|--------|
| **Ứng dụng web VinWonders Agent** | `vinwonders-agent/` | Chat UI (Next.js) + agent gọi công cụ qua **Ollama** |
| **Lab ReAct Python** | `src/`, `run_agent.py` | Agent ReAct (Thought → Action → Observation) — OpenAI / Gemini / model local GGUF |

Bạn có thể chỉ cần chạy **vinwonders-agent** nếu làm lab giao diện chat; chạy thêm phần Python nếu làm bài ReAct cổ điển.

---

## 1. Yêu cầu hệ thống

### Bắt buộc (cho app web)

| Công cụ | Phiên bản khuyến nghị | Ghi chú |
|---------|------------------------|---------|
| **Git** | Mới nhất | Clone repository |
| **Node.js** | **20 LTS** trở lên (tối thiểu 18.18+) | Chạy Next.js 16 |
| **npm** | Đi kèm Node | Cài dependency frontend |
| **Ollama** | Mới nhất | LLM chạy local, API tương thích OpenAI |

### Tùy chọn (cho lab Python)

| Công cụ | Phiên bản khuyến nghị | Ghi chú |
|---------|------------------------|---------|
| **Python** | **3.10+** | Agent ReAct, pytest |
| **OpenAI API key** | — | `DEFAULT_PROVIDER=openai` |
| **Gemini API key** | — | `DEFAULT_PROVIDER=google` |
| **Model GGUF (Phi-3)** | ~2.2 GB | `DEFAULT_PROVIDER=local` — không cần API cloud |

### Hệ điều hành

- **Windows 10/11**, **macOS**, hoặc **Linux** đều được.
- Trên Windows, nên dùng **PowerShell** hoặc **Windows Terminal**.

---

## 2. Clone repository

```bash
git clone <URL-repo-cua-ban>
cd Day-3-Lab-Chatbot-vs-react-agent
```

Thay `<URL-repo-cua-ban>` bằng URL Git thực tế (GitHub, GitLab, v.v.).

---

## 3. Cài đặt Ollama (cho app web)

App `vinwonders-agent` **không** gọi OpenAI/Gemini mặc định — nó kết nối **Ollama** tại `http://localhost:11434`.

### 3.1. Cài Ollama

1. Tải tại: [https://ollama.com/download](https://ollama.com/download)
2. Cài đặt và mở ứng dụng Ollama (icon chạy nền trên Windows/macOS).
3. Kiểm tra:

```bash
ollama --version
curl http://localhost:11434/api/tags
```

(Nếu không có `curl` trên Windows, mở trình duyệt: `http://localhost:11434` — thấy “Ollama is running” là được.)

### 3.2. Tải model

Model mặc định trong code: **`qwen2:1.5b`** (nhẹ, phù hợp lab; công cụ được **routing phía server**).

```bash
ollama pull qwen2:1.5b
```

Model lớn hơn, hỗ trợ **gọi tool native** (tùy chọn):

```bash
ollama pull qwen2:7b
# hoặc
ollama pull llama3.2:3b
```

Xem model đã có:

```bash
ollama list
```

### 3.3. Giữ Ollama chạy khi dev

- Mỗi lần dev app web, **Ollama phải đang chạy** trước khi gửi tin nhắn chat.
- Nếu chat báo lỗi 500 / không kết nối được model → kiểm tra lại bước này.

---

## 4. Chạy ứng dụng web `vinwonders-agent`

### 4.1. Cài dependency Node

```bash
cd vinwonders-agent
npm install
```

### 4.2. Biến môi trường (tùy chọn nhưng nên có)

Tạo file `vinwonders-agent/.env.local`:

```env
# URL gốc Ollama (không cần /v1 ở cuối)
OLLAMA_BASE_URL=http://localhost:11434

# Model mặc định khi mở app
OLLAMA_MODEL=qwen2:1.5b

# Bắt buộc true/false nếu model không tự nhận tool:
# - qwen2:1.5b → thường để false (routing tool phía server)
# - qwen2:7b, llama3.2 → có thể true hoặc bỏ trống (auto: không chứa "1.5b" = bật native tools)
# OLLAMA_SUPPORTS_TOOLS=false

# Giới hạn agent (tùy chọn)
# MAX_USER_MESSAGE_CHARS=800
# MAX_OUTPUT_TOKENS=320
# AGENT_TEMPERATURE=0.35
# LOG_SILENT=true
```

**Ghi chú:**

- File `.env.local` chỉ áp dụng cho thư mục `vinwonders-agent/`.
- Không commit file chứa secret lên Git.

### 4.3. Chạy development server

```bash
npm run dev
```

Mở trình duyệt: **http://localhost:3000**

### 4.4. Build production (tùy chọn)

```bash
npm run build
npm start
```

Vẫn cần Ollama chạy khi dùng chat.

### 4.5. Kiểm tra nhanh trên UI

Thử các gợi ý có sẵn hoặc gõ:

- `Bạn có thể giúp gì cho tôi tại VinWonders?` — trả lời chức năng
- `Trời mưa thì nên đi chơi đâu?` — tìm địa điểm
- `Đặt bàn Nhà hàng Hải Vương 4 người lúc 12:30` — đặt bàn
- `Tôi bị rơi cái ví ở tàu lượn, giúp với!` — khẩn cấp

Chọn model ở góc UI (nếu danh sách tải được). Model **1.5b** dùng routing tool phía server; model lớn hơn có thể gọi tool trực tiếp qua AI SDK.

### 4.6. Lint (tùy chọn)

```bash
npm run lint
```

---

## 5. Cài đặt & chạy lab Python (ReAct)

Phần này nằm ở **thư mục gốc** repository (không phải trong `vinwonders-agent`).

### 5.1. Tạo virtual environment

**Windows (PowerShell):**

```powershell
cd ..   # về thư mục gốc Day-3-Lab-Chatbot-vs-react-agent nếu đang ở vinwonders-agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
cd ..
python3 -m venv .venv
source .venv/bin/activate
```

### 5.2. Cài package Python

```bash
pip install -r requirements.txt
```

**Lưu ý Windows — `llama-cpp-python`:** Nếu cài lỗi khi build, bạn vẫn có thể chạy lab với `openai` hoặc `google` mà không cần local GGUF. Chỉ cần `llama-cpp-python` khi `DEFAULT_PROVIDER=local`.

### 5.3. Cấu hình `.env` (thư mục gốc)

```bash
cp .env.example .env
```

Chỉnh `.env` theo provider:

**OpenAI:**

```env
OPENAI_API_KEY=sk-...
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o
LOG_LEVEL=INFO
```

**Google Gemini:**

```env
GEMINI_API_KEY=...
DEFAULT_PROVIDER=google
DEFAULT_MODEL=gemini-1.5-flash
LOG_LEVEL=INFO
```

**Local GGUF (CPU, không cần API):**

1. Tạo thư mục `models/` ở thư mục gốc.
2. Tải [Phi-3-mini-4k-instruct-q4.gguf](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf) vào `models/`.
3. Cấu hình:

```env
DEFAULT_PROVIDER=local
LOCAL_MODEL_PATH=./models/Phi-3-mini-4k-instruct-q4.gguf
LOG_LEVEL=INFO
```

### 5.4. Chạy agent demo (Mock — không cần API)

Script có sẵn provider giả lập để học vòng ReAct:

```bash
python run_agent.py
```

Nhập câu hỏi khi được hỏi `User:`.

### 5.5. Test model local (nếu dùng GGUF)

```bash
python tests/test_local.py
```

### 5.6. Chạy pytest

```bash
pytest tests/ -v
```

(Ví dụ: `tests/test_security.py` nếu có trong repo.)

### 5.7. Log & telemetry

Agent Python ghi log JSON trong thư mục `logs/` (tạo khi chạy agent thật với provider cloud/local). Dùng log để phân tích Thought / Action / Observation — xem thêm `INSTRUCTOR_GUIDE.md`, `EVALUATION.md`.

---

## 6. Cấu trúc thư mục quan trọng

```
Day-3-Lab-Chatbot-vs-react-agent/
├── vinwonders-agent/          # Next.js app — CHẠY: npm run dev
│   ├── app/
│   │   ├── page.tsx           # Giao diện chat
│   │   └── api/chat/route.ts  # API agent + tools
│   ├── lib/                   # Policy, tools, Ollama, memory, security
│   └── package.json
├── src/
│   ├── agent/agent.py         # ReAct loop (lab Python)
│   ├── tools/                 # weather, ticket_search, location_search
│   └── core/                  # OpenAI, Gemini, Local providers
├── run_agent.py               # Demo ReAct + MockProvider
├── requirements.txt
├── .env.example               # Cấu hình lab Python
└── tests/
```

---

## 7. Biến môi trường — tóm tắt

### `vinwonders-agent/.env.local`

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Địa chỉ Ollama |
| `OLLAMA_MODEL` | `qwen2:1.5b` | Model chat mặc định |
| `OLLAMA_SUPPORTS_TOOLS` | auto (`false` nếu tên có `1.5b`) | Bật/tắt native tool calling |
| `MAX_USER_MESSAGE_CHARS` | `800` | Giới hạn độ dài tin user |
| `MAX_OUTPUT_TOKENS` | `320` | Token trả lời tối đa |
| `AGENT_TEMPERATURE` | `0.35` | Nhiệt độ sampling |
| `LOG_SILENT` | — | `true` = tắt log metrics console |

### `.env` (thư mục gốc — Python lab)

| Biến | Ý nghĩa |
|------|---------|
| `OPENAI_API_KEY` | Key OpenAI |
| `GEMINI_API_KEY` | Key Google AI |
| `DEFAULT_PROVIDER` | `openai` \| `google` \| `local` |
| `DEFAULT_MODEL` | Tên model API |
| `LOCAL_MODEL_PATH` | Đường dẫn file `.gguf` |
| `LOG_LEVEL` | Mức log Python |

---

## 8. Xử lý sự cố thường gặp

### App web không trả lời / lỗi 500

1. Ollama đã mở chưa? `ollama list` có model không?
2. Đã `ollama pull qwen2:1.5b` (hoặc model trong `OLLAMA_MODEL`) chưa?
3. Port 3000 có bị chiếm không — đổi port: `npm run dev -- -p 3001`
4. Xem terminal chạy `npm run dev` để đọc stack trace.

### “Không tải được danh sách model” trên UI

- UI gọi `GET /api/models`. Nếu route chưa có hoặc Ollama tắt, dropdown có thể trống — vẫn chat được nếu `OLLAMA_MODEL` trong `.env.local` khớp model đã pull.
- Đảm bảo Ollama chạy: `http://localhost:11434/api/tags`

### Model 1.5b trả lời chậm / lan man

- Bình thường với model nhỏ; thử `qwen2:7b` hoặc giảm `MAX_OUTPUT_TOKENS` trong `.env.local`.

### `npm install` lỗi trên Windows

- Cài **Node 20 LTS** từ [nodejs.org](https://nodejs.org).
- Chạy PowerShell **Run as Administrator** nếu lỗi quyền.
- Xóa `node_modules` và `package-lock.json`, chạy lại `npm install`.

### Python: `llama-cpp-python` không cài được

- Dùng `DEFAULT_PROVIDER=openai` hoặc `google`, hoặc chạy `python run_agent.py` (mock).
- Hoặc cài bản wheel phù hợp CPU/GPU theo tài liệu [llama-cpp-python](https://github.com/abetlen/llama-cpp-python).

### PowerShell không cho `Activate.ps1`

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 9. Quy trình chạy đầy đủ (checklist)

**Chỉ app web (khuyến nghị cho lab VinWonders UI):**

- [ ] Cài Node 20+, Git, Ollama  
- [ ] `ollama pull qwen2:1.5b`  
- [ ] `cd vinwonders-agent && npm install`  
- [ ] Tạo `.env.local` (tùy chọn)  
- [ ] `npm run dev` → mở http://localhost:3000  

**App web + lab Python:**

- [ ] Thêm: Python 3.10+, `venv`, `pip install -r requirements.txt`  
- [ ] `cp .env.example .env` và điền API key hoặc model GGUF  
- [ ] `python run_agent.py` hoặc tích hợp `ReActAgent` với provider thật  

---

## 10. Tài liệu liên quan trong repo

| File | Nội dung |
|------|----------|
| [README.md](./README.md) | Tổng quan lab Day 3 (Python) |
| [INSTRUCTOR_GUIDE.md](./INSTRUCTOR_GUIDE.md) | Hướng dẫn giảng dạy 4 giờ |
| [SCORING.md](./SCORING.md) | Tiêu chí chấm điểm |
| [SECURITY.md](./SECURITY.md) | Guardrails & bảo mật |
| [vinwonders-agent/AGENTS.md](./vinwonders-agent/AGENTS.md) | Ghi chú Next.js 16 cho agent code |

---

*Nếu bạn chỉ cần demo nhanh: cài Ollama → `ollama pull qwen2:1.5b` → `cd vinwonders-agent` → `npm install` → `npm run dev`.*
