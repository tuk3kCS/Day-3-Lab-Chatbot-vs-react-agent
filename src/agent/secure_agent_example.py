"""
Example: Secure ReAct Agent with Guardrails Integration

This file demonstrates how to integrate the GuardrailsValidator into the ReActAgent.
"""

import re
from textwrap import dedent
from typing import Any, Dict, List, Optional, Tuple

from src.core.llm_provider import LLMProvider
from src.security.guardrails import get_validator
from src.telemetry.logger import logger


class SecureReActAgent:
    """ReAct-style agent with security guardrails."""

    def __init__(self, llm: LLMProvider, tools: List[Dict[str, Any]], max_steps: int = 5):
        self.llm = llm
        self.tools = tools
        self.max_steps = max_steps
        self.history: List[Dict[str, Any]] = []
        self.trace: List[Dict[str, Any]] = []
        self.validator = get_validator()

    def get_system_prompt(self) -> str:
        tool_descriptions = "\n".join(
            f"- {tool['name']}: {tool.get('description', 'No description provided')}"
            for tool in self.tools
        )

        return dedent(f"""
            You are an intelligent assistant. You have access to the following tools:
            {tool_descriptions}

            Follow the ReAct pattern carefully.
            When you need a tool, respond using the exact format:
            Thought: <your reasoning>
            Action: tool_name(arguments)
            Observation: <tool result>

            If a tool is unavailable, explain why and choose a valid tool.
            If no tool is needed, return a Final Answer directly.

            Repeat Thought/Action/Observation as needed.
            When you are finished, answer with:
            Final Answer: <your final response>
        """)

    def run(self, user_input: str, user_id: str = "unknown") -> str:
        """
        Execute the agent with security guardrails.
        
        Args:
            user_input: User's query
            user_id: User identifier for tracking
            
        Returns:
            Final answer from the agent
        """
        
        # ✅ STEP 1: Validate input
        logger.log_event("SECURITY_INPUT_VALIDATION_START", {
            "user_id": user_id,
            "input_length": len(user_input),
        })
        
        if not self.validator.validate_input(user_input, user_id):
            error_msg = "Input validation failed. Please rephrase your question."
            logger.log_event("SECURITY_INPUT_VALIDATION_FAILED", {
                "user_id": user_id,
            })
            return error_msg

        logger.log_event("AGENT_START", {
            "input": user_input,
            "model": self.llm.model_name,
            "max_steps": self.max_steps,
            "user_id": user_id,
        })

        self.history = []
        self.trace = []
        prompt = user_input.strip()
        steps = 0
        total_input_tokens = 0
        total_output_tokens = 0

        while steps < self.max_steps:
            response = self.llm.generate(prompt, system_prompt=self.get_system_prompt())
            content = response.get("content", "").strip()
            
            # Track tokens
            usage = response.get("usage", {})
            total_input_tokens += usage.get("prompt_tokens", 0)
            total_output_tokens += usage.get("completion_tokens", 0)

            logger.log_event("AGENT_STEP", {
                "step": steps + 1,
                "content_length": len(content),
                "usage": usage,
                "latency_ms": response.get("latency_ms"),
            })

            if not content:
                logger.log_event("AGENT_EMPTY_RESPONSE", {"step": steps + 1})
                self.trace.append({"step": steps + 1, "status": "empty_response"})
                break

            self.history.append({"role": "assistant", "content": content})
            self.trace.append({"step": steps + 1, "assistant": content})

            final_answer = self._extract_final_answer(content)
            if final_answer:
                # ✅ STEP 2: Sanitize and validate output
                logger.log_event("SECURITY_OUTPUT_VALIDATION_START", {
                    "step": steps + 1,
                    "answer_length": len(final_answer),
                })
                
                # Validate for sensitive data
                if not self.validator.validate_output(final_answer):
                    logger.log_event("SECURITY_SENSITIVE_DATA_DETECTED", {
                        "step": steps + 1,
                    })
                    error_msg = "Output contains sensitive data. Please rephrase the question."
                    return error_msg
                
                # Sanitize output (mask emails, phones, etc.)
                sanitized_answer = self.validator.sanitize_output(final_answer)
                
                logger.log_event("SECURITY_OUTPUT_VALIDATION_SUCCESS", {
                    "step": steps + 1,
                })

                # ✅ STEP 3: Track resource usage
                logger.log_event("SECURITY_RESOURCE_TRACKING", {
                    "user_id": user_id,
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "steps": steps + 1,
                })
                
                resource_ok = self.validator.track_resource_usage(
                    request_id=user_id,
                    input_tokens=total_input_tokens,
                    output_tokens=total_output_tokens,
                    steps=steps + 1,
                )
                
                if not resource_ok:
                    logger.log_event("SECURITY_RESOURCE_LIMIT_EXCEEDED", {
                        "user_id": user_id,
                    })
                    # Don't fail the request, but log it
                    # The agent can still return but future requests may be limited

                logger.log_event("AGENT_FINAL_ANSWER", {
                    "answer_length": len(sanitized_answer),
                    "steps": steps + 1,
                })
                self.trace.append({
                    "step": steps + 1,
                    "status": "final_answer",
                    "final_answer": sanitized_answer,
                })
                logger.log_event("AGENT_END", {"steps": steps + 1})
                return sanitized_answer

            action = self._parse_action(content)
            if action is None:
                parser_error = "Unable to parse Action from model output."
                logger.log_event("AGENT_PARSE_ERROR", {
                    "step": steps + 1,
                    "content": content,
                })
                self.trace.append({"step": steps + 1, "status": "parse_error"})
                self.history.append(
                    {
                        "role": "tool",
                        "name": "parser",
                        "input": content,
                        "output": parser_error,
                    }
                )
                prompt = self._build_prompt(user_input, self.history)
                steps += 1
                continue

            tool_name, args = action
            
            # ✅ STEP 4: Validate tool before execution
            available_tools = [tool.get("name") for tool in self.tools]
            is_valid, error_msg = self.validator.validate_tool(
                tool_name, args, available_tools
            )
            
            if not is_valid:
                logger.log_event("SECURITY_TOOL_VALIDATION_FAILED", {
                    "step": steps + 1,
                    "tool": tool_name,
                    "error": error_msg,
                })
                observation = f"Security check failed: {error_msg}"
                self.history.append({
                    "role": "tool",
                    "name": tool_name,
                    "input": args,
                    "output": observation,
                })
                self.trace.append({
                    "step": steps + 1,
                    "tool": tool_name,
                    "status": "security_validation_failed",
                    "error": error_msg,
                })
                prompt = self._build_prompt(user_input, self.history)
                steps += 1
                continue

            # Tool validation passed, now execute
            logger.log_event("SECURITY_TOOL_VALIDATION_SUCCESS", {
                "step": steps + 1,
                "tool": tool_name,
            })
            
            observation = self._execute_tool(tool_name, args)
            self.history.append({
                "role": "tool",
                "name": tool_name,
                "input": args,
                "output": observation,
            })
            self.trace.append({
                "step": steps + 1,
                "tool": tool_name,
                "args": args,
                "observation": observation,
            })

            prompt = self._build_prompt(user_input, self.history)
            steps += 1

        logger.log_event("AGENT_END", {"steps": steps})
        return content or "I could not produce a final answer."

    def get_security_report(self) -> Dict[str, Any]:
        """Get security events and metrics for this session"""
        return self.validator.get_security_report()

    def get_trace(self) -> List[Dict[str, Any]]:
        """Return a copy of the execution trace for analysis."""
        return self.trace.copy()

    def _build_prompt(self, user_input: str, history: List[Dict[str, Any]]) -> str:
        prompt_lines = [user_input.strip()]
        for entry in history:
            if entry["role"] == "assistant":
                prompt_lines.append(entry["content"].strip())
            elif entry["role"] == "tool":
                prompt_lines.append(f"Observation: {entry['output'].strip()}")
        return "\n".join(prompt_lines)

    def _parse_action(self, content: str) -> Optional[Tuple[str, str]]:
        action_match = re.search(
            r"Action:\s*([A-Za-z0-9_]+)(?:\s*\((.*?)\))?",
            content,
            re.DOTALL,
        )
        if not action_match:
            return None

        tool_name = action_match.group(1).strip()
        args = action_match.group(2) or ""
        return tool_name, args.strip()

    def _extract_final_answer(self, content: str) -> Optional[str]:
        final_match = re.search(r"Final Answer:\s*(.*)", content, re.DOTALL)
        if not final_match:
            return None

        return final_match.group(1).strip()

    def _execute_tool(self, tool_name: str, args: str) -> str:
        for tool in self.tools:
            if tool.get("name") != tool_name:
                continue

            executor = (
                tool.get("function") or tool.get("execute") or tool.get("callable")
            )
            if callable(executor):
                try:
                    return executor(args)
                except Exception as exc:
                    error_message = f"Tool {tool_name} failed: {exc}"
                    logger.log_event(
                        "AGENT_TOOL_ERROR",
                        {
                            "tool": tool_name,
                            "args": args,
                            "error": str(exc),
                        },
                    )
                    return error_message

            return f"Tool {tool_name} has no executable function."

        available_tools = ", ".join(
            tool.get("name") for tool in self.tools if tool.get("name")
        )
        logger.log_event(
            "AGENT_TOOL_HALLUCINATION",
            {
                "tool": tool_name,
                "args": args,
                "available_tools": available_tools,
            },
        )
        return f"Tool {tool_name} not found. Available tools: {available_tools}."
