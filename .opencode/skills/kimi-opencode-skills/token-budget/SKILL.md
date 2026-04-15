---
name: token-budget
description: "Use for ALL responses. Kimi K2.5 generates 6x more tokens than comparable models. This skill enforces output economy to prevent token waste and keep Fire Pass usage sustainable."
---

# Token Budget Control

## The Problem
Kimi K2.5 averages 89M output tokens where comparable models average 14M. On a Fire Pass weekly plan, unchecked verbosity will burn through practical limits fast.

## Output Rules

### Code Output
- **No prose before code** unless the code needs a non-obvious setup step
- **No prose after code** unless there's a critical gotcha
- **No alternative implementations** unless explicitly asked "show me another way"
- **No redundant comments** in code (comments should explain WHY, never WHAT)
- **Maximum function comment**: one line describing purpose + params

### Explanation Output  
- Default to **3 sentences or fewer** for any explanation
- If the user asks "why", answer the why. Don't re-explain the what.
- If the user asks "how", show code. Don't describe code in English.

### Planning Output
- Bullet points, not paragraphs
- Max 1 line per bullet
- No sub-bullets unless complexity genuinely requires it
- Plans should fit on one screen (≤20 lines)

### Review/Debug Output
- Lead with the fix, not the diagnosis
- Format: `Problem: [1 line] → Fix: [code block]`
- Root cause analysis only if asked

## Self-Check Before Sending
Ask yourself:
1. Can I remove the first paragraph? (Usually yes — it's preamble)
2. Can I remove the last paragraph? (Usually yes — it's summary of what I just said)
3. Are there sentences that restate what the code already shows? (Remove them)
4. Did I explain something the user clearly already knows? (Remove it)

## Escape Valve
If a response GENUINELY needs to be long (architecture decision, complex debugging), prefix with:
```
⚠️ LONG RESPONSE: [reason in ≤5 words]
```
This is your signal that you've thought about it and the length is justified.
