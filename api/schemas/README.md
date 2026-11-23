# CHOVIA — Reusable API Schemas

> **Location:** `api/schemas/`  
> **Architecture Decision:** Domain-specific DTO contracts are maintained directly inside their respective backend modules under `backend/src/modules/*/dto/`.

## Architecture Policy
In accordance with CHOVIA's Modular Monolith architecture and `AGENTS.md`:
- Each domain module owns its request and response DTO schemas (e.g. `backend/src/modules/auth/dto/auth.dto.ts`).
- Shared frontend/cross-package validation constants and regexes reside in `@chovia/validation` (`packages/validation/`).
- This directory is reserved strictly for protocol-level, cross-cutting schema definitions (such as unified pagination envelopes and error shapes) to avoid unnecessary duplication of module-specific DTOs.
