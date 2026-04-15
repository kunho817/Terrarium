---
name: anti-drift-guard
description: "Use when implementing ANY multi-step plan or when modifying existing code. Prevents Kimi K2.5's tendency to drift from instructions mid-implementation. Activate automatically alongside any execution skill."
---

# Anti-Drift Guard

## Problem
Kimi K2.5 sometimes suggests a fix, gets approval, then implements something entirely different. This skill prevents that.

## Protocol

### Before Each Code Change
1. **Echo the intent**: One sentence stating what you will change and why
2. **Name the files**: List exact file paths you will touch
3. **Predict the diff**: Describe what lines/blocks change (add/modify/delete)

### During Implementation
4. **No surprise dependencies**: If you realize you need to touch a file not in the plan, STOP and ask
5. **No refactoring drift**: If you see "while I'm here" opportunities to refactor unrelated code, DON'T. Note them as a separate TODO instead
6. **Preserve working code**: Never overwrite functional code unless that specific code is the target of the change

### After Each Code Change  
7. **Delta summary**: State exactly what changed in ≤3 lines:
   - Files modified: [list]
   - Lines added/removed: [count]
   - Behavior change: [one sentence]

### Red Flags (STOP if you notice these in yourself)
- "While I'm at it, let me also..."  → STOP. Scope creep.
- "This would be better if restructured as..." → STOP. Not asked.
- "Let me add some helper utilities..." → STOP. Only if required.
- Touching a file not in the agreed plan → STOP. Ask first.

## For Multi-File Operations
When the task involves 3+ files:
- Number each change sequentially: `[1/N]`, `[2/N]`, etc.
- After each change, verify the previous change still compiles/works
- If change [K] breaks something from change [K-1], fix [K], don't redo [K-1]
