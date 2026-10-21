# Who Holds the Lifetime Bill

## Separating backend and UI in government IT procurement

*Discussion brief — private IT / government IT collaboration, 21 October 2026*

---

## 0. The root principle

**Whoever holds the bill optimises — for itself.** Whether the buyer benefits depends on two further conditions:

1. **Competition at the moment each bill is paid.** Optimisation passes through to the buyer's price only where the buyer has an alternative at that moment. The build is competitive once; every change after it is bought from the incumbent under monopoly. "The market sorts it out on average over time" holds for commodities; a one-off statutory system never reaches the average.
2. **The bill must reach a party that can change the form of purchase.** A running cost that is visible but routed to a desk with no authority over how the system was bought is noise. If the party who chose the form never sees the tail, and the party who pays the tail never chose the form, no amount of transparency corrects the decision.

A vendor paid for a build optimises the build. A vendor paid for a lifecycle optimises the lifecycle. A state that holds neither a credible alternative at each change moment nor the authority to change the form of purchase optimises nothing — it inspects, writes rules about how others should build, and pays later, elsewhere, for what the rules could not observe.

The design question is therefore not "in-house or outsourced," nor "build or SaaS." It is: **at every moment the state pays, does it have an alternative, and does the bill reach someone who can act on it.**

---

## 1. The problem

Current tenders buy "a solution to the process." Under such a contract the location of business rules is not a deliverable, acceptance tests only the UI, and the vendor's position — *the UI is the only interface, nothing requires the API to be independently usable, we build as we see fit* — is contractually correct. An architect asking for separation mid-project is asking for unpaid work.

Consequences: domain invariants end up in the UI; analysis conflates process with screens ("button X finishes process Y; when Y is finished the button disappears"); the UI cannot be replaced without re-buying the rules; no second client — third party or AI agent — can ever use the system; and the incumbent is the only party who knows where the rules are.

The vendor is not badly engineering. The build is well optimised for the objective function it was given. **The objective function was wrong, and that is the buyer's fault to fix.**

> We do not lack architects telling vendors where the rules should live; we lack a contract in which that is anybody's problem.

---

## 2. The proposal in one sentence

Procure and accept the backend (domain model, invariants, data, API) and the UI as separate artefacts, so that the home of the business rules is decided by contract structure rather than by architectural guidance — and so that the state owns the exit option.

Ownership of the invariant layer stays with the government IT house. Whether the build is in-house or outsourced is a per-product sourcing decision.

---

## 3. Rules change addressee: from vendor compliance to buyer obligation

"Business logic must be in the backend" is a rule aimed at the vendor, enforced by inspection, unobservable at acceptance. It fails.

What replaces it is two things, neither of which is a rule about how vendors build:

- **(a) Ownership obligations on the buyer that are observable** — the house authors, owns and tests specific artefacts (§5). Either a versioned API spec and a second-client test exist or they don't.
- **(b) Contract boundaries that make the vendor's local optimisation and the state's lifetime optimisation the same thing** (§4, §6).

The vendor then needs no rule. It optimises, and lands in the right place because the objective function was fixed upstream. This is mechanism design, not compliance.

Two conditions for it to work:

1. **Visibility only bites if it reaches someone who can change the form of purchase.** Today the ministry chooses the form and funds the build; the IT house inherits the system and pays maintenance from a pooled budget. The running cost is fully visible — and visible to the wrong party. Either the house carrying the tail gets authority over the form of purchase (ownership of the core), or the tail is attributed back to the sponsor so the initial decision carries its own maintenance bill. One of the two; otherwise the form is chosen by a party that will never pay for it.
2. **The buyer-side obligations are the irreducible residue of formal rule** — enforceable because the state enforces them on itself, and their violation is visible.

Anything in a tender that is neither (a) nor (b) is a wish.

---

## 4. The enforcement ladder

| Mechanism | Observable at acceptance? | Incentive aligned? | Status |
|---|---|---|---|
| **1. Architecture requirement in the tender annex** ("rules must live in the backend") | No — only the UI is tested | No | What we have now; fails |
| **2. API as a priced, separately accepted deliverable** — second-client test: the process runs end to end via API with no UI | Yes | Weak — one vendor controls both sides, puts logic where cheapest, complies minimally at the end | The floor |
| **3. Separate control of the two sides** — two lots / two vendors, API contract as shared annex, house as integrator | Yes | Yes — nobody *can* put a rule in the UI and call it done | The target |

Conway's law used on purpose: the contractual boundary is the only thing that reliably produces the architectural boundary. The stakeholder need not accept any architecture theory to see that acceptance criteria decide outcomes.

---

## 5. The non-negotiable core — the exit option

What the house keeps in every scenario. This is the operational definition of "ownership" and the content of the exit option.

- **API contract** — authored and versioned by the house; vendors implement against it, never author it as a deliverable.
- **Domain model and invariants** — written rules, independent of any screen.
- **Acceptance tests**, including the second-client test.
- **Data and schema evolution** — migrations reviewed and owned by the house. Whoever owns schema change owns the system.
- **Code and reproducible build in the public repository**, usable without the vendor present.
- **Competence to say no** — at minimum one architect and one domain owner per product.

Trade-off: a standing cost that appears in no tender price. It is the price of being able to re-tender. It will be called overhead.

---

## 6. Sourcing scenarios

| | Backend | UI | Integrator | Fits when |
|---|---|---|---|---|
| **S0** | wholesale "solution" | — | vendor | Status quo — being retired |
| **S1** | in-house | in-house | house | Small services, deep domain, scarce vendor knowledge |
| **S2** | in-house | tendered | house | Default candidate — contains the volatile layer, invariants stay home |
| **S3** | tendered | tendered, separate lot/vendor | house | Large multi-channel services; strongest enforcement |
| **S4** | tendered | tendered, same vendor | house (weakly) | Acceptable only with second-client acceptance as the floor |
| **S5** | tendered or in-house | market-built over a baseline UI (third parties, agents) | house | Mature APIs plus a mandate/consent regime |
| **S6** | SaaS with core owned by state | vendor or market | house | Statutory services where a vendor can credibly hold the lifecycle — *see §9* |

S5/S6 are the direction. S2 and S3 are choosable now. S4 is where procurement drifts unless prevented.

---

## 7. Minimal changes to tenders today — the seam without a reorganisation

1. **API contract as a first-class artefact** — versioned, published, with a deprecation policy; delivered before the UI is specified.
2. **Second-client acceptance** — a scripted or agent client executing the full process via API is an acceptance criterion with its own sign-off.
3. **Analysis deliverables restructured** — (a) states, events, invariants; (b) roles and mandates; (c) UI as a derived artefact. Analysis that cannot pass the second-client test on paper is not accepted.
4. **UI defined as replaceable** — takeover and warranty clauses treat the UI as independently re-tenderable; the backend accepts no scope that exists only to serve a particular UI.
5. **Two lots where the service is large enough**, API annex shared, house named as integrator.
6. **Change work is not sole-sourced by default.** Hourly maintenance from the incumbent is sole-sourcing without the name. The change moment needs its own alternative: a second framework vendor able to take change work (requires the core in §5), a priced change catalogue, or — cheapest and most effective — enough in-house capability that a small change is done in-house. The in-house alternative is the only price discipline that is present at every change, without a procedure.

Items 1–2 move from aspirational governance to observable acceptance. Item 5 is where build incentives change. Item 6 is where change prices change.

---

## 8. Objection: "Separation makes systems more expensive. Conflation is an optimisation."

**Where it is true.** For a small, single-channel service that lives a few years, a vendor who may put a rule wherever is cheapest builds cheaper. Concede the scale threshold.

**Where it breaks — it is a deferral, not a saving.** Conflation lowers *build* cost by raising *change* and *exit* cost. Paid back:

- at every rule change — the rule lives in UI and backend and must be changed in both, or found first;
- at every new channel (mobile, agent, third party) — no API to put it on, so a second copy of the process is bought;
- at UI replacement — the UI cannot be replaced without re-buying the rules, which is why UI replacements become full rewrites;
- at vendor exit — the incumbent alone knows where the rules are.

Government systems live 10–15 years; build is a minority of lifetime cost. Optimising the minority term at the expense of the majority term is an optimisation only for whoever does not hold the lifetime bill.

**The increment is smaller than claimed.** Nearly every modern system is already a browser client over an API. The ask is not a second system; it is that the API that already exists be coherent, versioned and tested as a product rather than as a side effect of screens. The second-client test is a scripted client — cheap, and with agents nearly free.

**Make them price it.** Ask for the premium as a number. Modest: insurance against the costs above, case made. Large: ask what becomes that much harder when rules must live in one place — usually the ambiguity being priced away is the ambiguity otherwise billed during change requests. A high premium is the vendor pricing the lock-in it loses.

**Reframe:** the state is not buying a cheaper system; it is buying the right to re-tender, add channels and change rules without the original vendor. "You pay more now" is true of every contract that preserves those rights.

### 8a. Follow-up objection: "A vendor who built the whole monolith also optimises the change better."

True — and irrelevant to what the state pays. The vendor's implementation cost of a change is not the state's cost; the *price* is, and the price is set at the change moment by the presence or absence of an alternative. The monolith is exactly what removes the alternative.

A real case: roughly 600 hours were billed to add an auto-complete field to one form, wired to a public address-lookup API. Comparable work on another system took a developer about four hours. The vendor very likely did it in four hours as well; the bill was 600 because nothing in the situation made it anything else. The build contract had been competitive and won on price. Maintenance was then bought from the same vendor by the hour. The 600-hour invoice was visible to everyone — and routed to an IT house with a pooled budget and no authority over how the system had been bought. The ministry that chose the form never saw it.

Separation is not valuable because it makes change cheaper to implement. It is valuable because it keeps a second implementer possible at every change moment, which is the only thing that disciplines the hourly price. The exit option is not about re-tendering; it is about the vendor knowing you could.

---

## 9. The radical position: "Define the process, then buy it as SaaS"

**Concede the strongest point.** On lifecycle incentive, nothing is left to object. SaaS is the one model in the room where the vendor holds the whole bill and therefore aligns build cost with change cost. It satisfies the root principle.

What remains are three things SaaS does to the *other* terms of the state's cost function:

**1. It optimises the vendor's lifetime cost, not the state's.** This is §0 condition 1 in its purest form. The state's cost is the price. In a competitive market price and efficiency move together. For a statutory Estonian process there is one buyer and, after go-live, effectively one seller — a bilateral monopoly, which is a negotiation, not a market. The vendor's efficiency is real; who captures it is decided by switching cost. Lifecycle alignment plus lock-in means the savings accrue to the vendor. SaaS does what the 600-hour case does, only with the alternative removed by design rather than by neglect.

**2. "Define first, then buy" reproduces the analysis-tender failure with a worse counterparty.** The process is a legal artefact; it changes with the law. Either regulatory-change risk is priced into the subscription (paying for ambiguity in advance) or changes are billed per request (change-request margins from a vendor that cannot be left). The upfront definition is validated by nothing until the product exists — as today — and the vendor now has every incentive to treat it as complete and bill divergence.

**3. Continuity of a statutory service cannot depend on a company's balance sheet.** The state must keep issuing permits if the vendor fails, is acquired or exits. That requires portable data, a documented model, an API and the ability to stand up an alternative — exactly the core in §5. SaaS for statutory processes is acceptable *with* that core owned by the state; at that point it is S6, not the radical position.

**On export.** Processes do not export; engines do. If the vendor can sell abroad, the Estonian process is configuration on their product and the state is buying COTS — fine, and that is the build/don't-build gate working (e-arveldaja is the case for *this*, not for building). If nobody abroad would buy it, the lifecycle economics rest entirely on Estonia and "sell it on" is decoration.

**Net position.** The radical proposal is right for exactly the systems the state should not build at all — commodity, competitive, non-statutory (§10). For statutory core it is acceptable only with the state owning the exit option (§5). The vendors' strongest argument and this brief share the same premise — whoever holds the lifetime bill optimises correctly. They differ only on whether the state may give up the right to change who that is.

---

## 10. What this does not solve — the upstream gate

Build / don't-build is decided before any of the above: does a market already exist, does statute require the service, is the process itself redundant. Separation does not stop e-arveldaja; it only builds its backend in the right place. Keep the arguments distinct.

---

## 11. Conceded limits and residual risks

- **Cost containment is indirect.** Expensive nice-to-haves are mostly backend (fields, exceptions, reports, integrations). Separation sorts the wish list into "UI-only, externalisable" and "domain change, on the taxpayer." The gain is that *does this change the domain or only its presentation?* becomes unavoidable per feature.
- **A baseline UI remains a state obligation.** Statutory services need a free, accessible, eID-authenticated interface that survives a vendor's exit. Separation caps UI spend at the baseline; the paid layer is value-added and mostly B2B.
- **Scale threshold.** Two contracts on a small service cost more than they save.
- **Third-party and agent UIs need a mandate regime.** Scoped, revocable, auditable delegation (the open-banking TPP problem) does not exist for citizens. It is the one platform investment serving citizens, companies and AI agents at once — and nobody asks for it because it has no screen.
- **Shadow invariants in the UI** if the API owner is slow to change — an operating-model cost; the platform side must be responsive.
- **Both lots to one vendor** — forbid it, or keep §7 item 2 as the floor.

---

## 12. On the companies' other positions

- *"More scoped projects, less workforce renting"* — scoped projects carry higher margin because of scope ambiguity. A UI-only project behind a stable API is *more* definable, hence lower margin. Expect rhetorical support for "anyone can build a UI" and resistance to the ownership core.
- *Workforce tenders* — price-dominated, experience criteria met by all bidders. The margin complaint is accurate; the proposed remedy (scoped projects) relocates the margin into ambiguity the state later pays for.

---

## 13. Asks for today

1. Agree the root principle (§0) and the enforcement ladder (§4) as the frame: acceptance criteria and contract boundaries decide outcomes, not architecture notes.
2. Adopt §7 items 1–3 as mandatory in all new development tenders — no reorganisation required.
3. Pilot S3 (two lots, API annex) on one large service.
4. Scope the mandate/consent infrastructure as a platform product.
5. Position the SaaS discussion as S6: welcome where the state keeps the core; declined where it does not.
6. Close the decision/cost gap: either the IT house that carries maintenance gets authority over the form of purchase, or maintenance cost is attributed back to the sponsoring ministry. And end default hourly sole-sourcing of change work (§7 item 6).
