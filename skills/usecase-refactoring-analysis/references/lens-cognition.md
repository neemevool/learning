# Lens L: cognitive load and findability

Source: article 011, §16a (working memory), §16c (comprehension is construction), §16e and §18 (understanding is a capacity; what documentation can carry).

## The idea

Working memory holds about four chunks of unfamiliar material. Experts hold more only because their chunks are larger, and chunks come from convention: code that follows a familiar pattern is read top-down from cues ("beacons"); code that breaks the pattern must be simulated step by step, and that is where capacity runs out. A codebase with four eras of convention has four sets of beacons, so a developer fluent in one reads the others as a novice.

The team's stated problem is exactly this: they cannot navigate the code mentally or find the right component for a task. This lens measures that directly instead of inferring it from structure.

You are a reasonable instrument for part of it. You have general React knowledge and none of this project's history, which is the position of a new team member. Where you had to search, a newcomer has to search.

## Measures to take for every use-case

Record these in a single finding with signal `L0` and the numbers in `measure`. They are the comparable core of this lens.

| Measure | How |
|---|---|
| `files_in_set` | count |
| `directories_spanned` | distinct directories at depth 3 under `src/` |
| `max_render_depth` | longest render chain from the route page to a leaf in the set |
| `indirection_hops_to_data` | from the component that displays the main entity, how many units (HOCs, hooks, stores) lie between it and the fetch |
| `eras_mixed` | distinct `created_year` bands (2020–21, 2022–23, 2024, 2025–26) present |
| `conventions_mixed` | which of these coexist in the set: `.jsx`/`.tsx`; HOC loader / fetch hook / fetch-in-effect; `styles` object / `sx` / theme factory |
| `search_attempts` | how many searches you needed to locate the entry component of this use-case starting from its user-visible name; list the queries that failed |

## Signals

| ID | Signal | Detect | Record in `measure` |
|---|---|---|---|
| L1 | **Name does not lead to the code.** The user-visible term for this screen or element does not appear in the name or path of the unit that implements it; or the unit is an anonymous default export, or a default export named differently from its file (191 and 89 known cases) | your own search log; inventory | term, actual name |
| L2 | **One name, several units.** Same component or hook name defined in more than one place (76 component names and 31 hook names are known to repeat; `NumberComponent` ×18, `Root` ×10) | inventory | name, paths, which one this use-case executes |
| L3 | **Several names, one concept.** Synonyms across eras or languages for the same thing (`dokument`/`document`, `redaktor`/`editor`) | names in the set | the synonyms |
| L4 | **Too much to hold.** Changing one behaviour requires facts from more than about five units that are not adjacent in the tree | pick the use-case's main operation; list what must be read to change it safely | units |
| L5 | **Convention break inside one unit or directory.** Mixed loading or styling styles side by side | read | which |
| L6 | **Misleading location.** Unit sits under a directory whose name suggests another use-case or another owner | path vs. consumers | path, real consumers |
| L7 | **Decoy.** A plausible-looking unit for this use-case that the trace shows is not executed (older generation, dead twin, unrouted page) | `executed: no` units a search would find first | decoy id, real id |
| L8 | **Reason not recoverable.** Non-obvious code (guard, special case, ordering) with no comment, test or commit message explaining it | `git log -L` or blame on the lines | location |
| L9 | **Long unit.** A single component or hook too large to simulate | LOC, branch count | loc |

L7 deserves care. It is the mechanism behind "we cannot tell whether X is still active": the code a developer finds first is the wrong one. Every decoy you can demonstrate with a trace is direct evidence for the team.

## Typical moves

L9 → `split-by-responsibility`. L5 → `unify-data-access` where it concerns loading.

L1, L2, L3, L6 and L7 have no local move in the schema. Naming and placement are decided once, in the synthesis. L8 becomes an open question for a senior developer; answers to those are what an architecture decision record should later capture.
