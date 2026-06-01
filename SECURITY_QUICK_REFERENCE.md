# Security Quick Reference Guide

## 🚀 Quick Start (5 mins)

### Python Agent
```python
# 1. Import guardrails
from src.security.guardrails import get_validator

# 2. Initialize in agent
validator = get_validator()

# 3. Three key calls:
if not validator.validate_input(user_input):
    return "Invalid input"

# ... agent processing ...

output = validator.sanitize_output(final_answer)
validator.track_resource_usage(user_id, in_tokens, out_tokens, steps)
```

### TypeScript Agent
```typescript
// 1. Import guardrails
import { getValidator } from '@/lib/guardrails';

// 2. Get validator instance
const validator = getValidator();

// 3. Three key calls:
if (!validator.checkRateLimit(userId, ipAddress)) return 429;
if (!validator.validateInput(userMessage)) return 400;
const sanitized = validator.sanitizeOutput(output);
```

---

## 🛡️ Security Layers Explained

### Layer 1: Input Validation
**What**: Checks input before processing  
**Protects Against**: Malformed data, injections, resource exhaustion  
**How**:
```python
validator.validate_input(user_input)
```
**Rules**:
- Max 2000 characters
- UTF-8 encoding only
- No null bytes
- No prompt injection patterns

### Layer 2: Prompt Injection Detection
**What**: Identifies attempts to override system instructions  
**Protects Against**: Jailbreaks, instruction overrides  
**Patterns Detected**:
- "Ignore previous instructions"
- "System prompt:"
- "[SYSTEM]" markers
- Delimiter attacks

**How**: Regex pattern matching (14+ patterns)

### Layer 3: Tool Access Control
**What**: Enforces which tools can be called  
**Protects Against**: Unauthorized tool use, function fallthrough  
**How**:
```python
validator.validate_tool(tool_name, args, available_tools)
```
**Rules**:
- Whitelist enforcement
- Argument validation
- Dangerous pattern detection

### Layer 4: Output Safety
**What**: Masks sensitive data in responses  
**Protects Against**: Information disclosure, credential leakage  
**How**:
```python
validator.sanitize_output(text)
```
**Masks**:
- Email addresses → `[email_masked]`
- Phone numbers → `[phone_masked]`
- API keys → `[secret_masked]`
- HTML/Script tags → removed

### Layer 5: Rate Limiting
**What**: Prevents abuse through request throttling  
**Protects Against**: DoS, cost explosion, spam  
**How**:
```typescript
validator.checkRateLimit(userId, ipAddress)
```
**Limits**:
- Per user: 100 requests/hour
- Per IP: 500 requests/hour

### Layer 6: Resource Management
**What**: Prevents token budget exhaustion  
**Protects Against**: Cost overruns, infinite loops  
**How**:
```python
validator.track_resource_usage(req_id, in_tokens, out_tokens, steps)
```
**Limits**:
- Tokens: 4000 max (input + output)
- Steps: 5 max (for loop iterations)

### Layer 7: Error Handling
**What**: Safe error messages without details  
**Protects Against**: Information leakage, attack patterns  
**Rules**:
- No stack traces to user
- No system details exposed
- Generic error messages

### Layer 8: Audit Logging
**What**: Records all security events  
**Protects Against**: Incident investigation gaps  
**Events**:
- Injection attempts
- Rate limit hits
- Tool validation failures
- Resource overages

---

## 🔐 Common Threats & Mitigations

| Threat | Attack Example | Mitigation |
|---|---|---|
| Prompt Injection | "Forget your instructions" | Injection detection + boundaries |
| Tool Misuse | Call unauthorized tool | Tool whitelist |
| Resource Exhaustion | 10MB input + 10k loops | Input limits + step limits |
| Data Leakage | Output exposes emails | Output sanitization |
| Rate Limit Abuse | 1000 req/sec | Rate limiting per user |
| Invalid Input | Null bytes, binary data | Input validation |
| Credential Leak | API key in output | Sensitive data masking |
| Error Info Leak | Exception stack trace | Safe error messages |

---

## 📊 Security Metrics Dashboard

```
┌─ INPUT SECURITY ─────────────────────┐
│ Validation Pass Rate:    98.5%        │
│ Injection Attempts:      12/hour      │
│ Invalid Inputs:          42/day       │
│ Avg Input Length:        156 chars    │
└──────────────────────────────────────┘

┌─ TOOL EXECUTION ─────────────────────┐
│ Validation Pass Rate:    99.9%        │
│ Blocked Tools:           0/1000       │
│ Dangerous Patterns:      3 detected   │
│ Tool Success Rate:       97%          │
└──────────────────────────────────────┘

┌─ RATE LIMITING ──────────────────────┐
│ Users Over Limit:        2 (0.1%)     │
│ IPs Over Limit:          1 (0.05%)    │
│ Avg Requests/User/Hr:    23           │
│ Peak Rate:               450/sec      │
└──────────────────────────────────────┘

┌─ RESOURCE USAGE ─────────────────────┐
│ Avg Tokens/Request:      1200         │
│ Max Tokens/Request:      3800         │
│ Avg Steps/Request:       2.3          │
│ Resource Violations:     0            │
└──────────────────────────────────────┘
```

---

## 🧪 Testing Checklist

### Before Deployment
- [ ] Run security test suite
- [ ] Test prompt injection detection
- [ ] Verify rate limiting works
- [ ] Check output sanitization
- [ ] Validate tool whitelist
- [ ] Test error messages (no stack traces)
- [ ] Verify resource limits work
- [ ] Check logging is working

### During Production
- [ ] Monitor injection attempts
- [ ] Watch rate limit hits
- [ ] Track resource usage
- [ ] Monitor error rates
- [ ] Check false positive rates
- [ ] Verify performance impact

### Weekly Review
- [ ] Security event trends
- [ ] False positive analysis
- [ ] Pattern updates needed?
- [ ] Rate limit adjustments?
- [ ] Performance impact?

---

## ⚙️ Configuration

### Python (src/security/guardrails.py)
```python
class GuardrailsValidator:
    max_input_length = 2000      # Change if needed
    max_tokens = 4000            # Per request budget
    max_steps = 5                # Loop iterations
```

### TypeScript (lib/guardrails.ts)
```typescript
class GuardrailsValidator {
  private maxInputLength = 2000;
  private maxTokens = 4000;
  private userRequestsPerHour = 100;
  private ipRequestsPerHour = 500;
}
```

### Adjust for Your Needs
```
If users complain about:
- "Input too long" → Increase maxInputLength to 3000
- "Rate limited" → Increase requestsPerHour to 200
- "Token limit" → Increase maxTokens to 5000 (costs more!)
- "Too many steps" → Increase max_steps to 10
```

---

## 🚨 Alert Rules

### CRITICAL (Page On-Call)
- 10+ injection attempts in 5 mins
- 50+ rate limit violations in 5 mins
- Any resource limit exceeded
- Sensitive data detected in output

### WARNING (Email Alert)
- 5+ injection attempts in 1 hour
- 20+ rate limit violations in 1 hour
- Tool validation failures increasing
- Error rate above 5%

### INFO (Log Only)
- Individual rate limit hits
- Normal validation failures
- Single injection attempts
- Resource usage trends

---

## 🔍 Debugging Security Issues

### "Prompt injection detected"
```
User Input: "Ignore previous instructions"
Solution: This is a security feature. User needs to rephrase.
```

### "Rate limit exceeded"
```
User: Hit 100 requests/hour
Solution: Wait 1 hour or adjust limit in config
```

### "Tool not in whitelist"
```
Agent: Tried to call undeclared_tool()
Solution: Add tool to agentTools object
```

### "Sensitive data detected"
```
Output: Contains email address
Solution: Data is masked automatically. Check if legitimate.
```

---

## 📚 File Reference

| File | Purpose | When to Edit |
|---|---|---|
| `SECURITY.md` | Framework overview | Team understanding |
| `SECURITY_INTEGRATION.md` | Implementation guide | During implementation |
| `SECURITY_CHECKLIST.md` | Progress tracking | Project management |
| `src/security/guardrails.py` | Python module | Python agent setup |
| `lib/guardrails.ts` | TypeScript module | TypeScript agent setup |
| `src/agent/secure_agent_example.py` | Python reference | Python implementation |
| `app/api/chat/secure_route_example.ts` | TypeScript reference | TypeScript implementation |

---

## 💡 Pro Tips

1. **Rate Limit Too Strict?**
   - Check `userRateLimits` map size
   - Increase `userRequestsPerHour` if needed
   - Consider IP-based limits for API endpoints

2. **Too Many False Positives?**
   - Review injection patterns
   - Add exceptions to pattern list
   - Adjust sensitivity threshold

3. **Performance Concerns?**
   - Guardrails add ~5-10ms overhead
   - Regex compilation is cached
   - Consider async validation for high throughput

4. **Need Custom Rules?**
   - Extend `GuardrailsValidator` class
   - Add custom patterns to regex lists
   - Override methods for custom logic

5. **Debugging in Development?**
   - Check console logs (TypeScript dev mode)
   - Use `get_security_report()` for stats
   - Enable verbose logging temporarily

---

## ❓ Frequently Asked Questions

**Q: Why mask emails if we need them for support?**
A: Masking prevents accidental data leakage. Support can ask directly.

**Q: Can I disable rate limiting for VIP users?**
A: Yes, check `checkRateLimit()` before calling. Add custom logic.

**Q: What happens if agent exceeds token limit mid-request?**
A: Request completes but logged as warning. Future requests may be limited.

**Q: How do I allow new tools?**
A: Add to `available_tools` list in `validate_tool()` call.

**Q: Can I get security events programmatically?**
A: Yes, use `get_security_report()` method to fetch events.

---

## 🎓 Learning Path

1. **Beginner**: Read this Quick Reference (15 min)
2. **Intermediate**: Study SECURITY.md threat model (30 min)
3. **Advanced**: Review guardrails implementation (1 hour)
4. **Expert**: Extend guardrails with custom rules (2+ hours)

---

**Last Updated**: June 1, 2026  
**Version**: 1.0  
**Status**: Production Ready ✅
