import unicodedata
from src.agent.agent import ReActAgent
from src.tools.weather import weather
from src.tools.ticket_search import ticket_search
from src.tools.location_search import location_search


def normalize(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text


class MockProvider:

    model_name = "mock"

    def generate(self, prompt, system_prompt=None):

        if "Observation:" not in prompt:

            norm = normalize(prompt)

            weather_keywords = ["thoi tiet", "nhiet do", "weather", "mua", "nang", "bao"]
            ticket_keywords = ["gia ve", "ve vao cua", "ticket", "combo", "gia tien"]
            location_keywords = ["quan an", "khach san", "nha hang", "dia diem", "o dau", "gan day", "location", "map"]

            if any(kw in norm for kw in weather_keywords):
                return {
                    "content": (
                        "Thought: Người dùng hỏi thời tiết, tôi cần dùng weather.\n\n"
                        "Action: weather(phu quoc)"
                    )
                }

            if any(kw in norm for kw in ticket_keywords):
                return {
                    "content": (
                        "Thought: Người dùng hỏi giá vé, tôi cần dùng ticket_search.\n\n"
                        "Action: ticket_search(vinwonders phu quoc)"
                    )
                }

            if any(kw in norm for kw in location_keywords):
                return {
                    "content": (
                        "Thought: Người dùng hỏi địa điểm, tôi cần dùng location_search.\n\n"
                        f"Action: location_search({prompt.strip()})"
                    )
                }

            return {
                "content": (
                    "Thought: Tôi cần tìm thông tin liên quan.\n\n"
                    "Action: ticket_search(vinwonders phu quoc)"
                )
            }

        # Đã có Observation — tóm tắt kết quả thực tế
        observation = prompt.split("Observation:")[-1].strip()

        return {
            "content": (
                "Thought: Tôi đã có đủ thông tin để trả lời.\n\n"
                f"Final Answer: {observation}"
            )
        }


tools = [
    {
        "name": "weather",
        "description": "Get weather information",
        "function": weather
    },
    {
        "name": "ticket_search",
        "description": "Get VinWonders ticket information",
        "function": ticket_search
    },
    {
        "name": "location_search",
        "description": "Search for locations, restaurants, hotels and nearby places",
        "function": location_search
    }
]

agent = ReActAgent(
    llm=MockProvider(),
    tools=tools,
    max_steps=5
)

question = input("User: ")

answer = agent.run(question)

print("\nFinal Answer:")
print(answer)