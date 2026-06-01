## 1. Tổng Quan Về Hệ Thống Tool - Current Tool Ecosystem
VinWonders AI Agent sử dụng hệ thống các công cụ cốt lõi sau để hỗ trợ du khách:

* *Lost & Found:* Tìm đồ vật/người đi cùng thất lạc (hỗ trợ khẩn cấp).

* *Booking Tool:* đặt nhà hàng, đặt vé vui chơi, đặt phòng Vinpearl


## 2. Chi Tiết Các Phiên Bản Tiến Hóa - Tool Spec Progression Log

#### Phiên bản 1.0: Hỏi-Đáp AI (Pure Text-Based Q&A) 
* **Mô tả kỹ thuật:** AI hoạt động hoàn toàn dựa trên luồng hội thoại dạng văn bản thô (Raw text responses). Khi du khách báo mất đồ hoặc tìm đường, AI phản hồi bằng các đoạn hướng dẫn dài chứa các bước thực hiện hoặc liệt kê danh sách địa danh.
* **Hạn chế & Điểm nghẽn:**
    * *Mật độ chữ quá cao:* Du khách ở thực địa (đang di chuyển, mệt mỏi hoặc hoảng loạn do mất đồ) rất khó đọc hết các đoạn văn bản dài để tìm thông tin.
    * *Tỷ lệ Drop-out cao:* Quy trình báo mất đồ qua text tốn nhiều lượt chat (multi-turn) để thu thập đủ thông tin (Tên đồ vật, màu sắc, vị trí rơi), làm giảm hiệu suất xử lý khẩn cấp.
    * *Đối với Báo mất đồ khẩn cấp:* AI tự động hiển thị một mã xác nhận kèm số điện thoại để user xác nhận, còn thiếu thông báo cụ thể mất đồ ở đâu và đồ gì.

#### Phiên bản 2.0: Hybrid & Tương tác (Hybrid & Interactive Component) - *Phiên bản hiện tại *
* **Mô tả kỹ thuật:** Kết hợp sức mạnh hiểu ngữ cảnh của Generative AI với giao diện thành phần tương tác trực quan (Interactive UI Components như Cards, Maps, Forms găm sẵn).
    * *Đối với Park Navigation:* Thay vì mô tả đường đi bằng chữ, AI kích hoạt hệ thống bản đồ số (Dynamic Mini-map). Lộ trình đi đến nơi trú ẩn hoặc điểm biểu diễn gần nhất được vẽ trực tiếp trên bản đồ nhúng ngay trong khung chat.
    * *Đối với Báo mất đồ khẩn cấp:* AI tự động hiển thị một **Quick Form** có mã xác nhận (Form khai báo nhanh dạng Hybrid đè lên giao diện chat đi kèm với số điện thoại) để user chọn nhanh loại đồ vật, chụp hình/tải ảnh lên và định vị vị trí hiện tại chỉ với 1 chạm.
* **Cải tiến vượt trội (Rationale):**
    * Tăng cường trải nghiệm trực quan (Visual-first experience) phù hợp với môi trường du lịch ngoài trời.

---

## 3. BẢNG SO SÁNH THÔNG SỐ KỸ THUẬT CHI TIẾT (TOOL SPEC EVOLUTION)

| Tính năng kỹ thuật | Phiên bản 1.0 (Hỏi-Đáp AI) | Phiên bản 2.0 (Hybrid & Tương tác) | Lý do chuyển đổi (Rationale) |
| :--- | :--- | :--- | :--- |
| **Giao diện phản hồi (UI/UX)** | Văn bản thuần túy (Text-only), danh bạ gạch đầu dòng. | Rich Media Cards, Bản đồ nhúng (Mini-map), Nút bấm tương tác (Quick Actions). | Tối ưu hiển thị trên Mobile, giúp du khách tiếp nhận thông tin trong 3 giây. |
| **Luồng Báo mất đồ** | Chat qua lại nhiều bước để lấy thông tin. | Pop-up Form tích hợp chụp ảnh vật thể và Auto-GPS vị trí rơi. | Đơn giản hóa quy trình khẩn cấp, đẩy dữ liệu về trung tâm an ninh tức thì. |
| **Luồng Tìm nơi trú / Định vị** | Đưa ra tọa độ văn bản hoặc chỉ dẫn dạng mô tả chữ. | Vẽ luồng đường đi trực quan trên Bản đồ công viên dựa theo GPS thực tế. | Tránh việc du khách bị lạc đường khi gặp sự cố thời tiết. |
| **Cơ chế xử lý (Backend)** | Chỉ dùng LLM sinh văn bản (Text Generation). | Function Calling (Gọi hàm hệ thống) + Trả về UI Component tương ứng với mã lỗi/trạng thái. | Đảm bảo tính chính xác tuyệt đối của dữ liệu hệ thống (Vé, Vị trí, Bản đồ). |

---

## 4. GỢI Ý TỐI ƯU SAU KHI CÓ BẢN DEMO UX/UI ĐẦY ĐỦ

Khi đội ngũ thiết kế hoàn thiện bản Demo UX/UI hoàn chỉnh (Figma/Prototype), tài liệu tiến hóa công cụ cần được bổ sung các hạng mục thực nghiệm sau:

1.  **UI-to-Spec Mapping (Ánh xạ Giao diện):** Tiến hành chụp ảnh màn hình các trạng thái của *Bản đồ định vị nơi trú* và *Form báo mất đồ* để chèn trực tiếp vào tài liệu kỹ thuật này. Developer cần nhìn rõ giao diện khi Tool trả về trạng thái Thành công (Success) hoặc Lỗi (Error).
2.  **Kiểm thử Giới hạn Ký tự (Text Clipping Test):** Xác thực xem các câu trả lời ngắn gọn của phiên bản Hybrid có bị tràn khung (clipping) trên các màn hình thiết bị di động có độ phân giải thấp hay không.
3.  **Thiết kế Trạng thái Ngoại lệ (Edge Cases UI):** Cập nhật đặc tả kỹ thuật cho các kịch bản mất kết nối mạng tại công viên. Ví dụ: Khi du khách đang ở vùng sóng yếu (Low Connectivity), Tool Định vị nơi trú sẽ tự động chuyển về chế độ Bản đồ tĩnh offline (Static Offline Image) thay vì cố tải Bản đồ động trực tuyến.
"""