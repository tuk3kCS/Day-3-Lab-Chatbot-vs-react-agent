import requests

def weather(location: str) -> str:
    """
    Real-time weather using wttr.in
    """

    location = location.strip()

    try:
        response = requests.get(
            f"https://wttr.in/{location}?format=3",
            timeout=10
        )

        if response.status_code == 200:
            return response.text.strip()

        return f"Weather service returned status {response.status_code}"

    except Exception as e:
        return f"Weather API error: {e}"