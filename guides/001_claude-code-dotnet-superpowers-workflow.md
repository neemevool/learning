# Spec-driven .NET development with Claude Code, superpowers, subagents and hooks

A practical setup guide for running ADR/spec-driven work in Claude Code with context isolation (subagents), deterministic verification (hooks + a build/test wrapper), and the `obra/superpowers` skill set as the workflow backbone.

**Assumptions:** recent Claude Code, Opus as the main-session model, Windows with Git Bash and PowerShell 7 (`pwsh`) available, a .NET solution with xUnit/NUnit/MSTest tests. Adjust shell commands if your environment differs.

**The core principle behind everything below:** do not rely on the model's own statement that it is "done". Make completion checkable and let the harness enforce it. Three layers do that:

| Layer | What it fixes | Where |
|---|---|---|
| Plan format | Items the implementer can silently skip | Plan conventions in `CLAUDE.md` |
| Subagent isolation | Main-session context bloat, attention dilution | superpowers `subagent-driven-development` |
| Hooks + wrapper | "Done" without green build/tests; verbose test output eating context | `.claude/settings.json`, `eng/verify.ps1` |

---

## 1. Start using obra/superpowers

### 1.1 Install and verify

1. In Claude Code, install from the official marketplace:
   ```
   /plugin install superpowers@claude-plugins-official
   ```
   Alternative (the author's own marketplace, sometimes newer):
   ```
   /plugin marketplace add obra/superpowers-marketplace
   /plugin install superpowers@superpowers-marketplace
   ```
2. Restart Claude Code.
3. Smoke test in a scratch folder: start `claude` and type *"Let's build a small console todo app"*. A working install triggers the `brainstorming` skill before any code is written.
4. Optional, relevant in government environments: superpowers' brainstorming visual companion loads a logo from the author's site (version-only telemetry). Disable it by adding `"SUPERPOWERS_DISABLE_TELEMETRY": "1"` to the `env` block of your settings (shown in chapter 2).
5. Read the skills you will rely on most, at least once: `writing-plans/SKILL.md`, `subagent-driven-development/SKILL.md` and its `implementer-prompt.md`. They change often; this guide describes their behavior at the time of writing.

### 1.2 The skill chain

| Skill | Activates | What it does | Your role |
|---|---|---|---|
| `brainstorming` | Before code on a new idea | Socratic design refinement, saves a design doc | Answer questions, approve design |
| `using-git-worktrees` | After design approval | Creates isolated worktree/branch, verifies clean test baseline | See 2.5 and 3.4 regarding worktrees |
| `writing-plans` | With an approved design/spec | Breaks work into small tasks with exact files, interfaces, tests, verification steps | **Review the plan** (main human checkpoint) |
| `subagent-driven-development` | With a plan | Fresh implementer subagent per task, task review after each, whole-branch review at end | Monitor, unblock |
| `test-driven-development` | During implementation | RED-GREEN-REFACTOR discipline | None |
| `requesting-code-review` / `receiving-code-review` | Between tasks | Review against plan, severity-ranked findings | Occasionally adjudicate |
| `finishing-a-development-branch` | When all tasks done | Verifies tests, offers merge/PR/keep | Choose outcome |
| `systematic-debugging` | On bugs/failures | Root-cause process instead of guessing | None |
| `verification-before-completion` | Before claiming done | Evidence before claims | None |
| `diagnosing-superpowers` | When a session misbehaves | Reads the transcript, explains what went wrong | Ask: *"figure out what went wrong with superpowers in this session"* |

Skills trigger automatically. You can also name them explicitly (`use superpowers:writing-plans ...`), which is more reliable when you want to skip steps.

### 1.3 How it maps to your ADR/spec process

- **`brainstorming` ≈ your ADR discussion.** Two ways to combine them:
  - **(a) Keep your ADR process** (recommended for well-understood features): discuss with Opus as you do now, write ADR + spec, then start superpowers at `writing-plans`, pointing it at the ADR and spec. Tell it explicitly to skip brainstorming.
  - **(b) Let brainstorming lead** (for fuzzy requirements): it produces a design doc; afterwards ask Opus to extract the ADR from it.
- **`writing-plans` ≈ your task specs**, but finer grained and TDD-shaped: every task has files to create/modify, an *Interfaces* block (what it consumes/produces), test steps and verification commands, and the plan starts with *Global Constraints* copied from the spec.
- **An important difference: by default superpowers plans contain complete code.** Its rules forbid placeholders and require code blocks for code steps. Its model-selection guidance then says: when the plan contains the complete code, implementation is transcription plus testing, so use the cheapest model; for implementers working from prose, use a mid-tier model as the floor.

**On the economics** (this corrects the assumption that a detailed spec gives no savings): an implementation session of ~200K tokens is mostly *input* tokens: re-reading files, build output, test output, fix iterations. The code itself is a small fraction. If Opus writes the code into the plan, you pay Opus once for the code's output tokens, and the expensive agentic loop (build, test, fix) runs on a cheaper model. So even a "full code" plan is an economy. It is not the only option; chapter 2 configures a middle ground (complete tests, signatures plus behavior for production code) that suits a Sonnet implementer.

### 1.4 Daily workflow by task type

**Feature or multi-step change** (the default path; details in chapter 3):
1. Design: ADR/spec discussion in a session (or `brainstorming`).
2. `/clear`, then plan: `writing-plans` from the ADR + spec.
3. Review the plan yourself. This is your main quality lever.
4. `/clear`, then execute: `subagent-driven-development` on the plan.
5. Finish: `finishing-a-development-branch`, then PR.
6. Retrospective, 5 minutes: turn recurring reviewer findings into rules (3.7).

**Bug:** describe the symptom; `systematic-debugging` runs in the main session. Write a plan only if the fix turns out to be large.

**Small change (under ~30 minutes of work):** say *"small change, skip brainstorming and planning"*. TDD and verification still apply, and hooks still enforce build/tests.

**Session behaves oddly** (skills fire wrongly, plan ignored, token burn): run `diagnosing-superpowers` before changing your setup.

**Context rule of thumb:** one session per phase (design, plan, execute). The artifacts (ADR, spec, plan file) carry state between phases, not the chat.

---

## 2. Preparing a .NET project

This is the same pattern in every repository, so it is a good candidate for a personal skill (2.8). The manual steps come first so you understand every piece.

**What you add to the repository:**

```
<repo>/
├── Directory.Build.props            # compiler-level constraints (2.1)
├── .editorconfig                    # analyzer severities (2.1)
├── CLAUDE.md                        # commands, conventions, plan + SDD policy (2.5)
├── eng/
│   ├── verify.config.json           # the ONLY project-specific part of the tooling (2.2)
│   └── verify.ps1                   # build/test wrapper used by you, Claude, hooks, CI (2.2)
└── .claude/
    ├── settings.json                # hooks, permissions, env (2.4)
    ├── hooks/
    │   └── redirect-dotnet.ps1      # blocks raw dotnet build/test (2.3)
    └── state/                       # runtime counters; add to .gitignore
```

### 2.1 Move constraints into the compiler

Every rule the compiler or an analyzer enforces is one the implementer model no longer has to remember. This matters more for a weaker model than any prompt.

1. `Directory.Build.props` at the repo root:
   ```xml
   <Project>
     <PropertyGroup>
       <Nullable>enable</Nullable>
       <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
       <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
       <AnalysisLevel>latest-recommended</AnalysisLevel>
     </PropertyGroup>
   </Project>
   ```
   For an existing codebase, measure first:
   `dotnet build -p:TreatWarningsAsErrors=false -p:EnforceCodeStyleInBuild=true`
   If there are hundreds of warnings, start with `<WarningsAsErrors>nullable</WarningsAsErrors>` and tighten gradually.
2. `.editorconfig`: raise the severity of the rules you care about to `error` (e.g. `dotnet_diagnostic.CA2007.severity = error` where relevant, naming rules, `IDE0005` unused usings).
3. Optional but high-leverage: an architecture test project (NetArchTest.Rules or ArchUnitNET) for layering rules such as "Domain does not reference Infrastructure" or "handlers do not use DbContext directly". Analyzers ship as NuGet packages, so they are not affected by restrictions on installing dotnet tools.

### 2.2 The verification wrapper

**Why a wrapper instead of hooks calling `dotnet` directly:**
- One entry point for you, Claude, hooks and CI. All project-specific knowledge lives in one JSON file.
- **Condensed output.** Raw `dotnet test` output is a major context consumer when Claude runs tests repeatedly. The wrapper returns only errors and failures, capped.
- It can be called independently, with the same result as the gate.

**Step 1: `eng/verify.config.json`** (edit per project):
```json
{
  "solution": "MySolution.slnx",
  "buildArgs": ["-nologo", "-v", "q", "-clp:ErrorsOnly;NoSummary"],
  "testArgs": ["--no-build", "--nologo", "--logger", "console;verbosity=minimal"],
  "filterArgName": "--filter",
  "gateTestArgs": ["--filter", "Category!=Integration"],
  "testFailurePattern": "(Failed |error |Assert|Expected|Actual|Exception|Error Message| at .+:line \\d+|Total tests|Failed!)",
  "maxOutputLines": 60,
  "maxGateBlocks": 3
}
```
Notes:
- `testArgs`, `filterArgName` and `gateTestArgs` depend on your test runner. The values above are for VSTest-style `dotnet test`. With Microsoft.Testing.Platform (xUnit v3, TUnit, MSTest runner) the argument names differ; put the correct ones here and the script stays unchanged.
- `gateTestArgs` defines what must pass before any subagent may finish. Keep it fast: unit and architecture tests, not integration tests with containers.

**Step 2: `eng/verify.ps1`:**
```powershell
#Requires -Version 7
<#
  Single entry point for build/test. Used by humans, Claude Code, hooks and CI.
    -Mode build               incremental build, errors only
    -Mode test [-Filter x]    build + tests (optional filter), failures only
    -Mode gate                build + gate test set (used by the SubagentStop hook)
  -FromHook: read hook JSON from stdin, report failures on stderr with exit code 2.
#>
param(
  [ValidateSet('build','test','gate')] [string]$Mode = 'build',
  [string]$Filter,
  [switch]$FromHook
)

# --- hook input (cwd, session/agent id) ----------------------------------
$hookInput = $null
if ($FromHook) {
  $raw = [Console]::In.ReadToEnd()
  if ($raw) { $hookInput = $raw | ConvertFrom-Json }
}

$root = if ($hookInput -and $hookInput.cwd) { $hookInput.cwd } else { Split-Path $PSScriptRoot -Parent }
Set-Location $root
$cfg = Get-Content (Join-Path $root 'eng/verify.config.json') -Raw | ConvertFrom-Json
$max = if ($cfg.maxOutputLines) { [int]$cfg.maxOutputLines } else { 60 }

# --- loop guard: never block the same agent forever ----------------------
$stateDir = Join-Path $root '.claude/state'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$key = if ($hookInput.agent_id) { $hookInput.agent_id }
       elseif ($hookInput.session_id) { $hookInput.session_id }
       else { 'manual' }
$counterFile = Join-Path $stateDir "gate-$key.count"

function Pass {
  if (Test-Path $counterFile) { Remove-Item $counterFile -Force }
  if (-not $FromHook) { Write-Output "OK ($Mode)" }
  exit 0
}

function Fail([string]$title, [object[]]$lines) {
  $msg = "$title`n" + (($lines | Select-Object -First $max) -join "`n")
  if (-not $FromHook) { Write-Output $msg; exit 1 }

  $count = if (Test-Path $counterFile) { [int](Get-Content $counterFile) } else { 0 }
  $count++
  Set-Content $counterFile $count
  $limit = if ($cfg.maxGateBlocks) { [int]$cfg.maxGateBlocks } else { 3 }
  if ($count -gt $limit) {
    Remove-Item $counterFile -Force
    [Console]::Error.WriteLine("verify gate: still failing after $limit blocks, letting the agent stop. The reviewer/controller must handle it.`n$msg")
    exit 1   # non-blocking: shown to you, agent may stop
  }
  [Console]::Error.WriteLine("verify gate failed (attempt $count of $limit). Fix this before finishing:`n$msg")
  exit 2     # blocking: stderr is fed back to the agent, which continues working
}

function Invoke-Build {
  $out = & dotnet build $cfg.solution @($cfg.buildArgs) 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail 'BUILD FAILED' ($out | Where-Object { "$_" -match ': (error|warning) ' } | Select-Object -Unique)
  }
}

function Invoke-Tests([string[]]$extra) {
  $testArgs = @($cfg.solution) + @($cfg.testArgs) + $extra
  $out = & dotnet test @testArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail 'TESTS FAILED' ($out | Where-Object { "$_" -match $cfg.testFailurePattern })
  }
}

switch ($Mode) {
  'build' { Invoke-Build; Pass }
  'test'  {
    Invoke-Build
    $extra = @(); if ($Filter) { $extra = @($cfg.filterArgName, $Filter) }
    Invoke-Tests $extra; Pass
  }
  'gate'  { Invoke-Build; Invoke-Tests @($cfg.gateTestArgs); Pass }
}
```
This is a starting point. Tune `testFailurePattern` after seeing real failures from your runner.

**Step 3: try it manually**
```
pwsh -NoProfile -File ./eng/verify.ps1 -Mode build
pwsh -NoProfile -File ./eng/verify.ps1 -Mode test -Filter "FullyQualifiedName~SomeTests"
pwsh -NoProfile -File ./eng/verify.ps1 -Mode gate
```
Break a test deliberately and confirm the output is short and useful. Note how long `gate` takes: that duration is added to every subagent completion.

> **If group policy blocks script execution** (execution policy set at MachinePolicy scope), use one of these: the same logic as a Bash script run through Git Bash, or a .NET 10 file-based app (`dotnet run eng/verify.cs`). The latter gives you C# for parsing TRX results, with slower startup. The hook commands in 2.4 change accordingly.

### 2.3 Hook script: redirect raw dotnet commands

`.claude/hooks/redirect-dotnet.ps1`:
```powershell
$in  = [Console]::In.ReadToEnd() | ConvertFrom-Json
$cmd = "$($in.tool_input.command)"
if ($cmd -match '(^|[;&|]\s*)dotnet\s+(build|test)\b') {
  [Console]::Error.WriteLine(@"
Use the wrapper instead of raw dotnet build/test:
  pwsh -NoProfile -File ./eng/verify.ps1 -Mode build
  pwsh -NoProfile -File ./eng/verify.ps1 -Mode test -Filter "<filter>"
It returns condensed output and matches the stop gate.
"@)
  exit 2
}
exit 0
```
Hooks intercept only Claude's own tool calls, so the wrapper's internal `dotnet` calls are unaffected.

### 2.4 `.claude/settings.json`

```json
{
  "env": {
    "SUPERPOWERS_DISABLE_TELEMETRY": "1"
  },
  "permissions": {
    "allow": [
      "Bash(pwsh -NoProfile -File ./eng/verify.ps1 *)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          { "type": "command",
            "command": "pwsh -NoProfile -File \"$CLAUDE_PROJECT_DIR/.claude/hooks/redirect-dotnet.ps1\"" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "general-purpose",
        "hooks": [
          { "type": "command",
            "command": "pwsh -NoProfile -File \"$CLAUDE_PROJECT_DIR/eng/verify.ps1\" -Mode gate -FromHook",
            "timeout": 900 }
        ]
      }
    ]
  }
}
```

**Design decisions:**
- **`SubagentStop`, not `Stop`.** `Stop` fires every time the main session finishes a reply, including during design discussions. Running a build there would be noise.
- **`matcher: "general-purpose"`.** superpowers dispatches its implementers and reviewers as `general-purpose` subagents. The built-in Explore and Plan agents are unaffected. Side effect: reviewers also pass through the gate. That costs one incremental build and is harmless when the implementer left things green. If you want the gate to apply to implementers only, see Appendix A.
- **No per-edit build hook.** In the middle of a multi-file change, intermediate states fail to compile, and per-edit builds give the model noise. If your projects build in a few seconds, you can add a `PostToolUse` hook on `Edit|Write` that builds only the nearest `.csproj`.
- **No test-file protection hook here.** superpowers' TDD flow has implementers write the tests, so blocking edits under `tests/**` would conflict with it. (It fits the Appendix A variant, where tests come pre-written.)
- **Loop guard.** The hook input has a `stop_hook_active` flag, but it has been reported unreliable in some situations, so the wrapper uses its own counter (`maxGateBlocks`).
- Add `.claude/state/` to `.gitignore`. Put personal overrides in `.claude/settings.local.json`, which is not committed.

### 2.5 `CLAUDE.md`

Keep it short. It loads into the main session and into every `general-purpose` subagent, so each line costs tokens many times over. Template:

```markdown
# <Project name>

## Build and test: always via the wrapper
- Build: `pwsh -NoProfile -File ./eng/verify.ps1 -Mode build`
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
```

Two notes on this template:
- **The worktree line** exists because hooks resolve `$CLAUDE_PROJECT_DIR` to the directory where Claude Code started. If an agent works in a worktree elsewhere, the gate would build the wrong checkout. Simplest rule: *you* create the branch or worktree and start `claude` inside it. The wrapper also uses the hook's `cwd`, which helps but does not cover every case.
- **The plan conventions deliberately soften superpowers' "complete code everywhere" rule.** Watch the first few plans. If `writing-plans` keeps writing full bodies anyway, you have two choices: accept it (it is still an economy, see 1.3, and you can move implementers to a cheaper model), or copy the skill into `~/.claude/skills/dotnet-writing-plans/`, edit it, and reference it by name in CLAUDE.md.

### 2.6 Validate the setup

1. Start `claude` in the repo and accept the workspace trust dialog; project hooks depend on it.
2. Run `/hooks` and check that both hooks are listed.
3. Ask: *"run dotnet build"*. The PreToolUse hook should block it and Claude should switch to the wrapper.
4. Break a unit test, then ask: *"use a general-purpose subagent to fix the failing unit test"*. Confirm the gate blocks the subagent's first stop if the test is still red, and releases it once green.
5. Run `/tasks` while a subagent is working to see its model.
6. If a hook does not fire, run `claude --debug` and look for hook errors.

### 2.7 Commit and share

Commit `Directory.Build.props`, `.editorconfig`, `CLAUDE.md`, `eng/`, `.claude/settings.json` and `.claude/hooks/`. Ignore `.claude/state/` and `.claude/settings.local.json`. Teammates then get identical behavior after installing superpowers.

### 2.8 Turn the setup into a personal skill

The scripts are generic, and only `verify.config.json` and parts of `CLAUDE.md` are project-specific. That split makes a good skill. Layout:

```
~/.claude/skills/dotnet-agentic-setup/
├── SKILL.md
└── templates/
    ├── verify.ps1
    ├── verify.config.json
    ├── redirect-dotnet.ps1
    ├── settings.hooks.json
    └── CLAUDE.sections.md
```

`SKILL.md`:
```markdown
---
name: dotnet-agentic-setup
description: Prepare a .NET repository for agentic work (verify wrapper, hooks, settings, CLAUDE.md sections). Use only when explicitly asked to set up or update agentic tooling.
disable-model-invocation: true
---

# .NET agentic setup

Templates are in `templates/` next to this file. Work in this order and stop for my confirmation where noted.

1. Discover: the solution file at repo root (ask if several); test projects; test runner
   (VSTest vs Microsoft.Testing.Platform, check global.json and package references);
   integration test traits/categories; existing Directory.Build.props, .editorconfig,
   CLAUDE.md, .claude/settings.json.
2. Report findings and the proposed verify.config.json. **Wait for confirmation.**
3. Write eng/verify.config.json. Copy verify.ps1 and redirect-dotnet.ps1 unchanged.
4. Merge hooks, permissions and env from settings.hooks.json into .claude/settings.json.
   Never drop existing keys; show the diff.
5. Add the CLAUDE.md sections from CLAUDE.sections.md. Propose one canonical exemplar file
   per pattern found in the codebase. **Wait for confirmation of exemplars.**
6. Do not modify Directory.Build.props. Instead measure the effect of stricter settings
   (build with -p: overrides) and report the warning counts per category.
7. Validate: run verify.ps1 in build, test and gate modes; report durations.
8. Add .claude/state/ and .claude/settings.local.json to .gitignore. Summarize changed files.
```

Invoke it with `/dotnet-agentic-setup` in each repository. Because of `disable-model-invocation: true`, it never triggers on its own.

---

## 3. Running it all together

Assumes superpowers is installed and the project is prepared as in chapter 2.

```
Session 1 (Opus)        Session 2 (Opus)          Session 3 (Opus = controller)
┌──────────────┐ /clear ┌────────────────┐ /clear ┌────────────────────────────────────┐
│ ADR + spec   │──────▶ │ writing-plans  │──────▶ │ subagent-driven-development        │
│ discussion   │        │ → docs/plans/  │        │  for each task:                    │
└──────────────┘        └────────────────┘        │   implementer (sonnet, fresh ctx)  │
       │                        │                 │     └─ SubagentStop gate: build+tests
   docs/adr/               YOU review             │   task reviewer (opus, fresh ctx)  │
   docs/specs/             the plan               │     └─ gaps → resume implementer   │
                                                  │  whole-branch review               │
                                                  └────────────────────────────────────┘
                                                              │
                                                  finishing-a-development-branch → PR
```

### 3.1 Step 1: Design (session 1)

1. Create the branch, or worktree, yourself. Start `claude` in that directory.
2. Discuss requirements with Opus as you do now. Produce the ADR in `docs/adr/` and the spec in `docs/specs/`.
   - To use superpowers here instead: let `brainstorming` run, then ask *"extract an ADR from the design doc into docs/adr/"*.
   - To keep your own process: tell it up front *"we are writing an ADR and spec; do not start brainstorming"*.
3. Commit the ADR and spec.

### 3.2 Step 2: Plan (session 2)

1. `/clear` (or start a new session).
2. Prompt:
   ```
   Use superpowers:writing-plans to create the implementation plan for
   docs/specs/<spec>.md (decisions: docs/adr/<adr>.md).
   Skip brainstorming; the design is approved. Follow the plan conventions in CLAUDE.md.
   Save to docs/plans/.
   ```
3. Optional context saver: planning a large feature can fill a lot of the main session. You can ask: *"write the plan in a general-purpose subagent and return only the file path"*.

### 3.3 Step 3: Review the plan (you)

This is where your time pays off most. Check:

- [ ] **Coverage:** every spec requirement maps to a task. The skill self-reviews this; spot-check it anyway.
- [ ] **Global Constraints** contain the ADR decisions and non-goals verbatim.
- [ ] **Checkability:** every requirement step has a `check:` line (test name, file, grep).
- [ ] **Interfaces** blocks agree across tasks (names, types, signatures).
- [ ] **Granularity:** production code is signatures plus behavior bullets, with full bodies only for the tricky parts. If it's full code everywhere, decide whether to accept that (1.3) or adjust.
- [ ] **Task size:** no task that obviously needs deep exploration or architectural choices. Those belong in the plan, not the implementer.

Fix issues by asking Opus to revise the plan, not by patching mid-execution. Commit the plan.

### 3.4 Step 4: Execute (session 3)

1. `/clear` (or a new session), in the directory where the code should change.
2. Prompt:
   ```
   Execute docs/plans/<plan>.md with superpowers:subagent-driven-development.
   Follow the model policy and delegation rules in CLAUDE.md.
   ```
3. What happens, per task:
   1. The controller (your Opus main session) extracts the task brief to a file and dispatches a fresh implementer subagent with an explicit model.
   2. The implementer works in its own context, using CLAUDE.md, Codegraph, Context7 and Microsoft Learn. Build and test calls go through the wrapper, so output stays condensed. Raw `dotnet test` is blocked and redirected.
   3. The implementer tries to finish, and the **SubagentStop gate runs `verify.ps1 -Mode gate`**. If build or gate tests fail, the stop is blocked and the condensed errors are fed back; the implementer continues. After `maxGateBlocks` attempts it is released with a warning shown to you.
   4. A fresh task reviewer checks the diff against the task: spec compliance and code quality. It reads the code rather than trusting the implementer's report.
   5. For findings, the controller **resumes the same implementer** with the gap list, so no context has to be rebuilt. A scoped re-review follows. superpowers has a five-round circuit breaker for this loop.
   6. The next task starts.
4. After the last task: a whole-branch review.

### 3.5 Step 5: Monitor and intervene

- **`/tasks`** shows running subagents and **the model each one actually uses**. Check it during the first runs. If implementers show Opus although the policy says Sonnet, the controller is not passing the model; restate the policy in the execute prompt.
- **BLOCKED / NEEDS_CONTEXT** from an implementer means it hit an ambiguity or a decision the plan didn't make. Treat it as feedback on the plan: answer it, and note the gap for the retrospective.
- **Gate released after max attempts** (the message appears in your terminal): the reviewer will usually flag it. If it keeps happening for one task type, that type is too hard for the implementer model.
- **Controller session getting long** on big plans: start a new session and say *"continue executing docs/plans/<plan>.md from the first unfinished task with subagent-driven-development"*. The plan and its progress tracking are the state.
- **Something looks systematically wrong:** *"figure out what went wrong with superpowers in this session"*.

### 3.6 Step 6: Finish

`finishing-a-development-branch` verifies tests and offers merge, PR or keep. Run the full wrapper including integration tests (`-Mode test` without a filter, or your CI) before the PR.

### 3.7 Step 7: Feedback loop (5 minutes per feature)

Ask the controller: *"summarize all reviewer findings and fix rounds by category"*. Then, for each recurring category, choose the strongest enforcement available:

| Finding type | Best fix |
|---|---|
| Rule violation detectable by analysis (layering, naming, async misuse) | Analyzer severity or architecture test (2.1) |
| Pattern deviation | Better exemplar file or a sharper CLAUDE.md convention line |
| Missed requirement | Plan conventions (more explicit `check:` lines, smaller tasks) |
| Wrong decision by implementer | The decision belongs in Global Constraints; tighten the ADR-to-plan copy rule |
| Task type repeatedly needs escalation | Route that task type to Opus in the SDD policy |

Over a few features this calibrates where Sonnet suffices and where Opus earns its cost. The answer comes from your data instead of intuition.

### 3.8 Context hygiene summary

- One session per phase. Artifacts carry state, chat does not.
- The controller only receives summaries, so keep implementer final reports short (superpowers already asks for structured status).
- The wrapper keeps build/test output small in every context.
- CLAUDE.md stays short. Knowledge goes into analyzers, exemplars and skills.
- MCP servers you only need in subagents can be scoped into a subagent definition (`mcpServers` field) to keep their tool descriptions out of the main session.

---

## Appendix A: Custom implementer agent (stricter variant)

Use this if you want the gate to apply **only to implementers**, want test files protected (tests pre-written in the plan), or want a per-item checklist gate. Instead of settings-level `SubagentStop` on `general-purpose`, define the implementer as its own agent type with hooks in its frontmatter.

`.claude/agents/dotnet-implementer.md`:
```markdown
---
name: dotnet-implementer
description: Implements exactly one task brief from a plan when dispatched by the subagent-driven-development controller.
model: sonnet
effort: high
tools: Read, Edit, Write, Grep, Glob, Bash, TodoWrite
maxTurns: 150
hooks:
  Stop:
    - hooks:
        - type: command
          command: "pwsh -NoProfile -File ./eng/verify.ps1 -Mode gate -FromHook"
          timeout: 900
---
You implement exactly one task brief.
1. Read the brief fully. Put every step and `check:` item into TodoWrite before coding.
2. Build and test only via ./eng/verify.ps1.
3. Before finishing, confirm each `check:` item and cite the evidence (file:line or test name).
4. Final report, max 15 lines: status, items with evidence, deviations, open questions.
```
A `Stop` hook in subagent frontmatter runs as `SubagentStop` for that agent only. Then:
1. Remove the `SubagentStop` / `general-purpose` block from `.claude/settings.json`.
2. Add to CLAUDE.md, SDD policy: *"Dispatch implementers with subagent_type `dotnet-implementer` instead of general-purpose."*
3. Verify with `/tasks` that implementers really run as `dotnet-implementer`. You are steering a skill's dispatch through an instruction, which may not always be followed.
4. Optional: add a `PreToolUse` hook on `Edit|Write` to this agent that rejects paths under `tests/` when plans ship complete tests.

---

## Appendix B: Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Hooks never fire | Workspace trust not accepted; check `/hooks`; run `claude --debug` |
| Gate loops forever | Counter file not writable; check `.claude/state/`; lower `maxGateBlocks` |
| Gate builds the wrong code | Agent works in a worktree outside the start directory; start `claude` inside the worktree (2.5) |
| Subagents run on Opus despite policy | Controller not passing `model`; restate in execute prompt; verify with `/tasks` |
| `pwsh` or script blocked | Group policy execution policy; use a Bash wrapper or `dotnet run eng/verify.cs` |
| Plans always contain full code | superpowers default; accept it (1.3) or fork `writing-plans` (2.5) |
| Skills don't trigger | Restart after install; check `/plugin`; name the skill explicitly |
| Test output still huge | `testFailurePattern` too broad, or Claude bypassing the wrapper via a different tool; widen the PreToolUse matcher |
