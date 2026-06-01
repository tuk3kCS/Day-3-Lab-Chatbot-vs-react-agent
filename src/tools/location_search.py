import os
import requests


PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def location_search(query: str) -> str:
    """
    Search for locations and nearby places using Google Maps Places API.
    """

    api_key = os.getenv("GOOGLE_MAPS_API_KEY")

    if not api_key:
        return "Error: GOOGLE_MAPS_API_KEY not set in environment."

    query = query.strip()

    search_resp = requests.get(
        PLACES_URL,
        params={
            "query": query,
            "key": api_key,
            "language": "vi",
        },
        timeout=10
    )

    if search_resp.status_code != 200:
        return f"API Error: {search_resp.status_code}"

    data = search_resp.json()

    if data.get("status") != "OK":
        return f"No results found for '{query}'. Status: {data.get('status')}"

    results = data.get("results", [])[:3]

    if not results:
        return f"No locations found for '{query}'."

    output = f"Kết quả tìm kiếm cho '{query}':\n\n"

    for i, place in enumerate(results, 1):

        place_id = place.get("place_id")
        name = place.get("name", "N/A")
        address = place.get("formatted_address", "N/A")
        rating = place.get("rating", "N/A")
        total_ratings = place.get("user_ratings_total", 0)
        open_now = place.get("opening_hours", {}).get("open_now")

        open_status = (
            "Đang mở cửa" if open_now is True
            else "Đang đóng cửa" if open_now is False
            else "Không rõ"
        )

        phone, website = _get_place_details(place_id, api_key)

        maps_link = f"https://www.google.com/maps/place/?q=place_id:{place_id}"

        output += (
            f"{i}. {name}\n"
            f"   Địa chỉ   : {address}\n"
            f"   Đánh giá  : {rating}/5 ({total_ratings:,} đánh giá)\n"
            f"   Trạng thái: {open_status}\n"
        )

        if phone:
            output += f"   Điện thoại: {phone}\n"

        if website:
            output += f"   Website   : {website}\n"

        output += f"   Bản đồ    : {maps_link}\n\n"

    return output.strip()


def _get_place_details(place_id: str, api_key: str):
    """
    Fetch phone number and website from Place Details API.
    """

    if not place_id:
        return None, None

    try:
        resp = requests.get(
            DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": "formatted_phone_number,website",
                "key": api_key,
                "language": "vi",
            },
            timeout=10
        )

        if resp.status_code != 200:
            return None, None

        result = resp.json().get("result", {})

        return result.get("formatted_phone_number"), result.get("website")

    except Exception:
        return None, None