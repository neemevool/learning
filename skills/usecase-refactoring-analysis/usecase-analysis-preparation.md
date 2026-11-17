# Preparing to run `usecase-refactoring-analysis`

The skill has two modes, and they need different preparation.

| Mode | Needs a running application | What you get |
|---|---|---|
| `static-only` | No | Structure, coupling, state and history findings. Liveness is "unknown" for every component |
| `traced` | Yes, with the frontend on the **Vite dev server** | The same, plus which components actually executed and how much of each |

Start with one `static-only` run to check that the skill and the data files work together. Then set up tracing.

## 1. Always needed

- **The skill installed** in the `koosloome-ui` repository: unpack `usecase-refactoring-analysis.skill` (a zip) into `.claude/skills/usecase-refactoring-analysis/`.
- **Node 18 or newer** on the machine where Claude Code runs. The three scripts have no dependencies.
- **The earlier analysis output** at `analysis/` in the repository: `data/components.json`, `hooks.json`, `hocs.json`, `jsx-callsites.json`, `usage.json`, `depcruise-raw.json`, and `clusters/`. If any are missing, re-run the scripts listed at the top of `analysis/REPORT.md`.
- **Full git history.** A shallow clone makes creation years and change coupling wrong. Check with `git rev-parse --is-shallow-repository`; it must print `false`.
- **A use-case definition**, written down before the run: teema liik, etapp, role, view, operation, and the user steps in order. The skill asks for it and will not invent one.

## 2. For a traced run

### The Compose stack is necessary but not sufficient

The stack provides the backend, Keycloak and the hubs. Its web container serves the production bundle, which is minified into a few files, so a trace taken at `localhost:3000` cannot be mapped to components. The coverage script detects this and stops.

The frontend must be served by `vite dev` from the `frontend/` source, pointed at the Compose backend. I have not verified this setup on your stack. These are the things likely to need attention:

- **Port.** `3000` is taken by the Compose web container. Either stop that one container and run Vite on 3000, or run Vite on another port.
- **Keycloak redirect URIs.** If Vite runs on another port, the client `koosloome-veebirakendus` must allow that origin. Stopping the web container and using port 3000 avoids this.
- **API and hub proxying.** The dev server must forward `/api` and `/hub/*` (WebSocket) to the gateway as the production web container does. Check whether `vite.config.js` already has this proxy.

Using port 3000 with the web container stopped is the least invasive choice, and it changes nothing under `frontend/`.

### Stack state

From your feasibility findings:

- Stack up and healthy; `http://localhost:3000` and `http://localhost:8036/auth/realms/Koosloome` respond.
- Service images rebuilt recently. Stale images broke the Slate hub silently before.
- Keycloak users in the `ee<isikukood>` form, password equal to username.

### A teema in the right state

Create it with a Jest seed (as in `poc-plan.md`, Task 4) or through the UI, and note the teema and versioon uuids. The teema must be in the etapp and have the content the use-case needs.

### Capturing the trace

The skill consumes a trace; it does not capture one. Until the characterization harness exists, a short Playwright script is enough. Chromium only.

```js
// trace-usecase.mjs — run with: node trace-usecase.mjs <teemaUrl> <out.json>
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [teemaUrl, out] = process.argv.slice(2);
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await page.coverage.startJSCoverage({ resetOnNavigation: false });

await page.goto('http://localhost:3000/');
await page.fill('#username', 'ee44512123422');
await page.fill('#password', 'ee44512123422');
await page.click('#kc-login');
await page.goto(teemaUrl);

// Perform the use-case steps here, by script or by hand, then press Resume in the inspector.
await page.pause();

const coverage = await page.coverage.stopJSCoverage();
// Drop the embedded source text; the mapping script does not need it and the file shrinks a lot.
writeFileSync(out, JSON.stringify(coverage.map(({ source, ...rest }) => rest)));
await browser.close();
```

Two points that affect what the trace means:

- **Coverage is cumulative from page load.** Login, the dashboard and the app shell are in every trace. That is correct (they are part of reaching the use-case), but it means the shell components appear in every record. To isolate the use-case itself, take a second trace that stops just before the first use-case step; the difference is the use-case.
- **Only the steps you perform are covered.** Panels not opened and error paths not triggered show as unexecuted. Write down what was skipped; the record has a field for it.

## 3. Starting a run

In Claude Code, from the repository root:

```text
Analyze this use-case for refactoring and write the record.

Use-case: EV teema, etapp Eelanalüüs, role Vastutaja, view EELANALÜÜS, operation fill-text.
Steps: open the teema; open Tekstid ja kommentaarid; type into Probleem; type into Eesmärk; wait for "Andmed salvestatud".
Trace: analysis/usecases/eelanalyys-fill-text-vastutaja/trace.json (V8 coverage, Vite dev server, agent walk).
```

For a `static-only` run, replace the last line with: `No trace. Static-only, starting from <entry component path>.`

## 4. What comes out

`analysis/usecases/<id>/` with `record.json`, `coverage.json`, `files.txt` and `coupling.json`. Nothing under `frontend/` is touched.

Check the first record before running more:

- Does the component list match what a developer who knows this view would expect, with nothing important missing?
- Open three findings at their cited lines. Are they true?
- Are the store reader and writer lists complete? With all stores mounted globally, this is the easiest part to get wrong.
