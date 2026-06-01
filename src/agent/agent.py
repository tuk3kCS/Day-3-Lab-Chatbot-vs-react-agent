import re
from textwrap import dedent
from typing import Any, Dict, List, Optional, Tuple

from src.core.llm_provider import LLMProvider
from src.telemetry.logger import logger


class ReActAgent:
    """
    ReAct-style Agent:
    Thought -> Action -> Observation -> Final Answer
    """

    def __init__(
        self,
        llm: LLMProvider,
        tools: List[Dict[str, Any]],
        max_steps: int = 5
    ):
        self.llm = llm
        self.tools = tools
        self.max_steps = max_steps
        self.history: List[Dict[str, Any]] = []
        self.trace: List[Dict[str, Any]] = []

    def get_system_prompt(self) -> str:
        """
        Build ReAct system prompt.
        """

        tool_descriptions = "\n".join(
            [
                f"- {tool['name']}: {tool['description']}"
                for tool in self.tools
            ]
        )

        return f"""
You are a ReAct Agent.

Available tools:
{tool_descriptions}

You MUST follow this format exactly:

Thought: reasoning about the problem

Action: tool_name(arguments)

Observation: tool result

(repeat if necessary)

Final Answer: final response

Rules:
1. Always start with Thought.
2. If you need external information, use an Action.
3. Never invent Observations.
4. Finish with Final Answer.
"""

    def _parse_action(self, text: str):
        """
        Extract:
        Action: tool_name(arguments)
        """

        match = re.search(
            r"Action:\s*(\w+)\((.*?)\)",
            text,
            re.DOTALL
        )

        if match:
            return match.group(1), match.group(2)

        return None, None

    def run(self, user_input: str) -> str:
        """
        Main ReAct loop.
        """

        logger.log_event(
            "AGENT_START",
            {
                "input": user_input,
                "model": self.llm.model_name
            }
        )

        current_prompt = user_input

        steps = 0

        while steps < self.max_steps:

            response = self.llm.generate(
                current_prompt,
                system_prompt=self.get_system_prompt()
            )

            result = response["content"]

            logger.log_event(
                "LLM_RESPONSE",
                {
                    "step": steps,
                    "response": result
                }
            )

            print(f"\n===== STEP {steps + 1} =====")
            print(result)

            # Final Answer
            if "Final Answer:" in result:

                final_answer = result.split(
                    "Final Answer:",
                    1
                )[1].strip()

                logger.log_event(
                    "AGENT_END",
                    {
                        "steps": steps + 1,
                        "status": "completed"
                    }
                )

                return final_answer

            # Parse Action
            tool_name, args = self._parse_action(result)

            if tool_name:

                observation = self._execute_tool(
                    tool_name,
                    args
                )

                logger.log_event(
                    "TOOL_CALL",
                    {
                        "tool": tool_name,
                        "args": args,
                        "observation": observation
                    }
                )

                current_prompt += (
                    f"\n{result}\n"
                    f"Observation: {observation}\n"
                )

            else:

                current_prompt += (
                    f"\n{result}\n"
                )

            steps += 1

        logger.log_event(
            "AGENT_END",
            {
                "steps": steps,
                "status": "max_steps_reached"
            }
        )

        return "Maximum reasoning steps reached."

    def _execute_tool(
        self,
        tool_name: str,
        args: str
    ) -> str:
        """
        Execute tool by name.
        """

        for tool in self.tools:

            if tool["name"] == tool_name:

                try:

                    if "function" in tool:
                        return str(
                            tool["function"](args)
                        )

                    return f"Executed {tool_name}"

                except Exception as e:

                    return f"Tool Error: {str(e)}"

        return f"Tool '{tool_name}' not found."
