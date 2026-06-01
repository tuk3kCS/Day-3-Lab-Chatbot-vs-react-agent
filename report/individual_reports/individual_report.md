# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: Nguyễn Hoàng Tùng
- **Student ID**: 2A202600628
- **Date**: 2026-06-01

---

## I. Technical Contribution (15 Points)

### Modules Implemented

| Module | File | Role |
|---|---|---|
| ReAct Loop core | `src/agent/agent.py` | Full Thought→Action→Observation cycle |
| Trace recorder | `src/agent/agent.py` (`self.trace`, `get_trace()`) | Per-step execution log for debugging |
| Hallucination guard | `src/agent/agent.py` (`_execute_tool`) | Detects and logs invented tool names |
| Spam-ticket fix | `vinwonders-agent/lib/agent-tools.ts` | SORRY_FALLBACK regex gate |

### Code Highlights

**1. `run()` loop — `src/agent/agent.py:55-126`**

The main ReAct loop calls the LLM, checks for a `Final Answer`, otherwise parses the `Action`, executes the tool, appends the `Observation` to the prompt, and iterates:

```python
while steps < self.max_steps:
    response = self.llm.generate(prompt, system_prompt=self.get_system_prompt())
    content = response.get("content", "").strip()

    final_answer = self._extract_final_answer(content)
    if final_answer:
        return final_answer

    action = self._parse_action(content)
    if action is None:
        # inject parse error as an observation and let the LLM retry
        self.history.append({"role": "tool", "name": "parser",
                              "input": content, "output": "Unable to parse Action..."})
        prompt = self._build_prompt(user_input, self.history)
        steps += 1
        continue

    tool_name, args = action
    observation = self._execute_tool(tool_name, args)
    prompt = self._build_prompt(user_input, self.history)
    steps += 1
```

**2. `_execute_tool()` hallucination guard — `src/agent/agent.py:161-183`**

When the LLM calls a tool name that does not exist, the agent logs `AGENT_TOOL_HALLUCINATION` and returns the list of valid tools as an observation so the LLM can self-correct instead of silently failing:

```python
logger.log_event("AGENT_TOOL_HALLUCINATION", {
    "tool": tool_name,
    "args": args,
    "available_tools": available_tools,
})
return f"Tool {tool_name} not found. Available tools: {available_tools}."
```

**3. SORRY_FALLBACK gate — `vinwonders-agent/lib/agent-tools.ts:82-83`**

Added a regex guard to prevent the agent from treating the LLM's own apology text as a user emergency/search request:

```typescript
const SORRY_FALLBACK =
  /(xin lỗi|sorry|bị lỗi|không biết|không thể|chưa rõ|không chắc)/i;
```

All four intent-detection branches now check `!SORRY_FALLBACK.test(lower)` before firing.

### How This Interacts With the ReAct Loop

`run()` is the entry point. Each iteration the LLM sees the growing prompt (original question + all previous Thought/Action/Observation turns). `_build_prompt()` serialises `self.history` into that flat string. `_parse_action()` extracts the tool call with a regex; on failure it injects a synthetic observation and continues rather than aborting. `get_trace()` exposes the per-step record for post-run analysis without re-running the agent.

---

## II. Debugging Case Study (10 Points)

### Problem Description

**Spam Emergency Tickets** — When the Ollama model (qwen2:1.5b) could not find a good answer, it would respond with an apology such as *"Xin lỗi, tôi không thể tìm thấy thông tin đó"* ("Sorry, I cannot find that information"). The regex in `detectServerTool` in `agent-tools.ts` matched keywords from the apology (e.g., `tìm` in the SEARCH_FALLBACK pattern) and triggered `handleEmergency` or `searchDestination` — creating ticket IDs like `VW-4821` for completely non-emergency conversations.

### Log Source

The bug manifested as repeated tool-output cards appearing in the chat UI immediately after any message the model was uncertain about. In the browser network tab, the response payload contained `tool-input-available` / `tool-output-available` events for `handleEmergency` even though the user had asked a normal question.

A representative server-side log line (from `logs/` output):

```json
{
  "event": "AGENT_STEP",
  "tool_name": "handleEmergency",
  "input": { "type": "lost_item", "description": "Xin lỗi tôi không thể tìm thấy thông tin" },
  "ticket_id": "VW-4821"
}
```

### Diagnosis

The root cause was that `detectServerTool` checked intent patterns against the **LLM's reply text** via `getLastUserText`, but the regex only looked at the last *user* message. However, when the model's apology was echoed back in follow-up turns, it slipped through as a user text fragment. More fundamentally, the EMERGENCY_INCIDENT and SEARCH_FALLBACK patterns were too broad — words like `tìm` ("find/search") appear in ordinary apology sentences, not just genuine requests.

The fix was at the pattern-matching level, not the LLM level: the model's behaviour was correct, the intent classifier was wrong.

### Solution

Added the `SORRY_FALLBACK` regex (commit `54645ca`, fixed syntax in `519d688`) that matches common apology/uncertainty phrases. All four detection branches (`EXPLORATION_INTENT`, `EMERGENCY_MEDICAL`, `EMERGENCY_INCIDENT`, `SEARCH_FALLBACK`) now early-exit if the message matches `SORRY_FALLBACK`, preventing false-positive tool calls from the model's own hedging language.

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

### 1. Reasoning

The `Thought:` block forces the model to externalise its plan before acting. In the plain chatbot, when asked "Is there a restaurant near the roller-coaster and can I book a table?", the model either answered partially or hallucinated a booking endpoint. With the ReAct loop the Thought step made the agent break the problem into two sub-goals: first search for restaurants near the ride, then check contact/booking info. The intermediate observations grounded the second step in real data rather than imagination.

### 2. Reliability — Cases Where the Agent Performed Worse

The agent was strictly worse than the chatbot in three situations:

- **Simple factual questions** — "What time does VinWonders open?" needed no tool. The chatbot answered immediately; the ReAct agent wasted one full LLM call on a Thought/Action cycle before realising no tool was necessary, doubling latency.
- **Parser failures on small models** — qwen2:1.5b frequently omitted the `Action:` line or used a slightly wrong format (`Action: search_destination` with an underscore instead of `searchDestination`). Each parse failure added a retry step, pushing total latency above 8 seconds for a 3-step chain.
- **Context window pressure** — Because the full history is concatenated into a single flat prompt string (`_build_prompt`), long conversations caused token counts to spike and the small model began truncating its output mid-Thought, breaking the format reliably.

### 3. Observation — How Feedback Shaped the Next Step

The most instructive example was the hallucination guard. On step 1 the model called `Action: get_restaurant_menu(res-01)` — a tool that does not exist. Without the guard the agent would have returned "Tool not found" and stopped. With the guard, the observation injected back into the prompt was: *"Tool get_restaurant_menu not found. Available tools: searchDestination, handleEmergency."* On step 2 the model corrected itself and called `Action: searchDestination(nhà hàng)`. The environment feedback directly steered the next reasoning step — which is the core value proposition of the ReAct architecture compared to a single-shot chatbot.

---

## IV. Future Improvements (5 Points)

- **Scalability**: Replace the flat string prompt in `_build_prompt` with a structured message array and a sliding-context window (similar to `vinwonders-agent/lib/memory/context-window.ts`). This prevents token blow-up in long sessions and would allow async/parallel tool execution for multi-action steps.

- **Safety**: Add a lightweight "supervisor" pass after `_parse_action` that validates the extracted tool name and argument schema against a whitelist before calling `_execute_tool`. This blocks prompt-injection attacks where a malicious observation tricks the agent into calling a destructive internal function.

- **Performance**: The regex-based intent detection in `detectServerTool` is fragile and language-specific. Replace it with a small embedding model (e.g., a quantised `bge-small-en`) for semantic intent classification, and move tool descriptions into a vector store so `get_system_prompt` only injects the top-k most relevant tools — reducing prompt tokens and improving Action accuracy on models with small context windows.
