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