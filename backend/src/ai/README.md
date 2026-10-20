# ProMoney Lab Backend AI Module (`backend/src/ai/`)

**Joint Owners:** Arpan Khatiwada & Suman Raut (Phases 5 & 6)

## Purpose
This directory is reserved for the backend AI services that power **ProMoney Lab**:
1. `ollamaClient.js` (Proposed — Phase 5): Local LLM connection wrapper for Ollama.
2. `financialTools.js` (Proposed — Phase 5): Read-only, deterministic financial tools that call `financeMath.js` and MySQL queries scoped to the authenticated `user_id`.
3. `xrayService.js` (Proposed — Phase 5): Explainable Financial X-Ray diagnostic engine with evidence citations.
4. `ragService.js` (Proposed — Phase 6): Retrieval-Augmented Generation over curated Japan personal finance documentation.
5. `actionApprovalService.js` (Proposed — Phase 6): Human-in-the-loop approval state machine.

## Mandatory Safety Rules
- **No Unapproved Writes**: AI models and tools must NEVER execute `INSERT`, `UPDATE`, or `DELETE` on user financial tables (`transactions`, `accounts`, `budgets`, `goals`, `bills`) without explicit user confirmation via the approval endpoint.
- **No Raw SQL Generation**: The LLM must never generate or execute raw SQL strings. It may only invoke predefined, parameterized tool functions.
- **No Fabricated Numbers**: All JPY figures cited by ProMoney Lab must come directly from `financeMath.js` or verified MySQL records.
