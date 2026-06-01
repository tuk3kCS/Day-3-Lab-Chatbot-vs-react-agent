def ticket_search(destination: str) -> str:
    """
    Mock ticket search tool with multiple destinations.
    """
    # Chuẩn hóa input đầu vào
    destination = destination.lower().strip()
    
    # Database giả lập
    database = {
        "vinwonders phu quoc": """
VinWonders Phú Quốc Ticket Information
- Adult Ticket: 950,000 VND
- Child Ticket: 710,000 VND
- Senior Ticket: 710,000 VND
Combo VinWonders + Safari:
- Adult: 1,350,000 VND
- Child: 1,000,000 VND
Opening Hours: 09:00 - 19:30
""",
        "ba na hills": """
Ba Na Hills Ticket Information
- Adult Ticket: 900,000 VND
- Child Ticket: 750,000 VND
"""
    }

    # 1. Nếu tìm thấy khớp hoàn toàn hoặc khớp một phần
    for key, info in database.items():
        if key in destination or destination in key:
            return info
            
    # 2. Nếu KHÔNG tìm thấy hoặc địa điểm quá chung chung (như trống rỗng)
    available_places = ", ".join([k.title() for k in database.keys()])
    return f"Không tìm thấy thông tin cho '{destination}'. Hệ thống hiện tại chỉ hỗ trợ tra cứu giá vé tại: {available_places}. Hãy yêu cầu người dùng làm rõ họ muốn đi đâu."