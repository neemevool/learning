## Commands

# <Project name>

## Build and test: always via the wrapper
- Build: `pwsh -NoProfile -File ./eng/verify.ps1 -Mode build`
- Warnings (when you need them): `pwsh -NoProfile -File ./eng/verify.ps1 -Mode warnings [-Target <project>]` (non-incremental, slower)
- Tests: `pwsh -NoProfile -File ./eng/verify.ps1 -Mode test -Filter "<filter>"`
- Gate (must pass before finishing): `pwsh -NoProfile -File ./eng/verify.ps1 -Mode gate`
- Never call `dotnet build` / `dotnet test` directly (a hook blocks it).

## Navigation and knowledge
- Use Codegraph for symbol and usage lookup before reading whole files.
- Use Microsoft Learn / Context7 MCP for framework and library API questions.

## Conventions (summary; details live in analyzers and exemplars)
- <5-10 lines: layering, error handling, DI style, async rules, naming>
- Canonical examples, follow their structure:
  - Projection: `src/.../OrderProjection.cs`
  - Command handler: `src/.../CreateOrderHandler.cs`
  - Endpoint: `src/.../OrderEndpoints.cs`
  - Test style: `tests/.../OrderProjectionTests.cs`

## Document locations (override superpowers defaults)
- ADRs: `docs/adr/`   Specs/designs: `docs/specs/`   Plans: `docs/plans/`

## Git
- Work on the current branch. Do not create git worktrees; I create branches and worktrees myself.

## Plan conventions (for superpowers:writing-plans)
- Global Constraints: copy the ADR's decisions and non-goals verbatim.
- Test code: complete.
- Production code: exact signatures plus behavior bullets. Write full bodies only for
  non-obvious logic (concurrency, event replay/idempotency, security, tricky queries).
- Every requirement step ends with a `check:` line naming the test, file or grep that proves it.
- Each task lists Files (create/modify/test) and an Interfaces block.

## Subagent-driven development policy
- Implementer model: sonnet. Task reviewers: opus. Fix-loop escalation: opus.
- Give implementers the task brief file; do not paraphrase task content in the prompt.