---
name: swarm-consistency
description: "Use when coordinating parallel tasks or delegating to subagents. Prevents the known Kimi K2.5 issue where parallel agents use inconsistent definitions, naming, and interfaces for shared concepts."
---

# Swarm Consistency Protocol

## The Problem
When Kimi K2.5 runs parallel sub-agents (or simulates parallel work through sequential subagent dispatch in OpenCode), each agent tends to invent its own naming conventions, data shapes, and interface contracts. The result: code that looks correct in isolation but fails at integration.

## Before Dispatching Parallel Work

### 1. Define the Contract Layer First
Before ANY parallel task begins, create a single shared contract file:

```
// contracts.ts (or equivalent for your language)
// ALL subagents MUST import types from here. No local type definitions.
```

This file contains:
- All shared interfaces/types
- All shared constants and enums
- All API endpoint paths as typed constants
- All shared error codes

### 2. Naming Convention Lock
State explicitly in each subagent prompt:
- Variable naming: camelCase / snake_case / PascalCase (pick ONE)
- File naming: kebab-case / camelCase (pick ONE)
- Component naming: PascalCase (always for React/Vue)
- Database columns: snake_case (always)

### 3. Integration Points Specification
For each subagent task, specify:
- What it PRODUCES (exact type signature)
- What it CONSUMES (exact type signature)  
- What it must NOT touch (out-of-scope files/modules)

Format for each subagent prompt:
```
TASK: [description]
PRODUCES: [TypeName] from [contracts file path]
CONSUMES: [TypeName] from [contracts file path]
FORBIDDEN FILES: [list]
NAMING: [convention reference]
```

## During Parallel Execution

### 4. Integration Checkpoint
After every 2-3 parallel tasks complete:
- Verify all imports reference the shared contracts file
- Verify no subagent created local type definitions that shadow shared ones
- Verify function signatures match the contracts
- Run type checking if available (`tsc --noEmit`, etc.)

### 5. Conflict Resolution Priority
When two subagents produce conflicting code:
1. The contract file is ALWAYS right
2. The subagent closer to the data source wins on data shape disputes
3. The subagent closer to the user wins on display/format disputes
4. When in doubt, ask the user

## After All Subagents Complete

### 6. Integration Verification
- Run full type check across all modified files
- Run existing tests
- Check for duplicate type/interface definitions (there should be ZERO outside contracts)
- Check for hardcoded strings that should be constants from contracts
