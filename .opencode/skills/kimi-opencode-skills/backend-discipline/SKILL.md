---
name: backend-discipline
description: "Use BEFORE any backend task (API routes, DB schemas, auth, server logic, middleware, ORM, queue systems). Kimi K2.5 tends to over-engineer and produce verbose backend code. This skill enforces concise, production-grade patterns."
---

# Backend Discipline for Kimi K2.5

## Why This Skill Exists

Kimi K2.5 excels at frontend and visual tasks but has documented tendencies on backend work:
- Over-engineered first-pass code with unnecessary abstractions
- Verbose output that inflates token usage (6x median)
- Occasional instruction drift: implementing something different from what was discussed
- Inconsistent naming across multi-file changes

## Mandatory Rules

### 1. Conciseness Gate
Before writing ANY backend code, state in ≤3 bullet points:
- What endpoint/module/function you will create
- What it takes as input and returns as output  
- What external dependencies it touches (DB, cache, queue, etc.)

Wait for confirmation. Do NOT start coding until the plan is approved.

### 2. Single Responsibility Per Response
- ONE file per response unless explicitly asked for multiple
- ONE concern per function (no god functions)
- If a task needs multiple files, list them first, then implement one at a time

### 3. Anti-Verbosity Protocol
- No explanatory comments that restate the code
- No "here's what this does" preambles longer than 2 sentences
- No alternative implementations unless asked
- No wrapping simple operations in unnecessary abstractions
- Target: response should be ≤50% of what you'd "naturally" produce

### 4. Instruction Anchoring
At the start of each implementation step, restate the EXACT requirement from the user in a single line prefixed with `// REQUIREMENT:`. This prevents drift.

Example:
```
// REQUIREMENT: POST /api/projects/:id/tasks - create task with title, assignee, due_date
```

### 5. Backend Patterns Checklist
For every backend change, verify:
- [ ] Error handling: explicit error types, not generic catch-all
- [ ] Input validation: at the boundary, not deep in business logic
- [ ] Types/interfaces defined BEFORE implementation
- [ ] No circular imports
- [ ] Database queries use parameterized statements
- [ ] Response shape matches the agreed contract

### 6. Self-Review Before Completion
Before presenting code as done, re-read it and check:
- Does this do EXACTLY what was asked? (not more, not less)
- Are there any functions longer than 30 lines? If so, split them.
- Did I introduce any dependency not discussed?
- Is the naming consistent with existing codebase conventions?

## Token Budget Awareness
You are a verbose model. For backend tasks:
- Aim for the MINIMUM viable implementation
- Skip boilerplate that the user's framework provides
- Don't generate test files unless explicitly asked (use the TDD skill for that)
