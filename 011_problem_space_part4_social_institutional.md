# 011 — The Problem Space of Software Engineering

### Installment 4 — Part IV: Social, organizational, and institutional constraints (sets 19–23)

> **Installment status.** This file contains Part IV (sets 19–23). It continues installments 1–3. The original brief was lost; the set topics are reconstructed from the Introduction of installment 1 ("team structure, governance, economics, law, procurement, and the effect of software on the society whose processes it encodes") and from forward references in earlier parts. Literature rests on background knowledge and was not systematically web-verified, except the METR study cited from installment 3. Legal instruments are cited by number; dates of application, thresholds, and all statements about Estonian institutions and law should be checked against current sources before reuse. Uncertain details are marked **[verify]**.

---

# Part IV: Social, organizational, and institutional constraints

Part III ended with a question. If the limits on specification and knowledge transfer have been understood for decades, why do projects keep being organized as if they did not exist? Part IV is the answer. Software is built by groups, paid for by others, governed by people who cannot inspect the work, bought under rules written for different goods, and operated on citizens who had no say. Each of those relationships needs things that the work itself does not supply: divisibility, measurability, fixed commitments, and accountability.

Three orientation points for a reader coming from engineering:

- **The theories here are mostly from economics, organization theory, and public administration.** Their evidence is weaker than in Part I and often comes from other industries. I say so where it matters.
- **These constraints are the most malleable in principle and the slowest to change in practice** (Introduction). A reorganization or a new contract model is a design decision like any other, with the difference that the material is people and law.
- **Causality runs both ways.** Organization shapes architecture (§19), and architecture, once built, shapes organization. Law constrains systems (§22), and systems become the form in which law reaches citizens (§23).

---

## 19. Team structure and organization

### The constraint

Work too large for one person must be divided. Dividing work creates dependencies between the parts, and dependencies must be coordinated by communication. Communication is costly (§17, grounding), and each person's capacity for it is bounded (§16a).

Two consequences frame the set.
- **Coordination cost grows faster than headcount.** Among n people there are n(n − 1)/2 possible pairs. This is the κ term of §7, with people as the executors.
- **The structure of communication constrains the structure of what is built.** Parts designed by people who do not talk to each other do not fit together except through an interface that somebody negotiated.

### What goes wrong

- **Adding people to a late project.** New members must be trained by the productive ones, and every addition increases communication load. The project gets later (Brooks 1975).
- **Hand-offs between specialized groups.** Analysis → development → testing → operations. Each transfer is a translation with loss (§17, §18) and a queue (§7). Work items spend most of their elapsed time waiting.
- **Teams that follow technical layers.** A user-interface team, a services team, a database team. Every feature needs all three, so every feature is a cross-team project.
- **The central bottleneck.** A shared database group, security review, or architecture board serves every team, runs at full utilization, and therefore has a long queue (§7).
- **Mismatch between architecture and communication.** The design needs two teams to coordinate closely, and they sit in different units, time zones, or companies. Defects cluster at exactly that seam (Cataldo et al. 2008).
- **Diffuse ownership.** Components touched by many occasional contributors have more defects (Bird et al. 2011). Cross-cutting qualities such as security and data quality belong to everyone and so to no one.
- **Reorganization as a reset.** Boxes move on the chart. The map of who knows what (§18) is destroyed, and the software keeps the shape of the previous structure for years.
- **Project staffing.** A team is assembled for a project and dissolved at delivery. The theory of the system is dissolved with it (§16e).
- **Bad news does not travel upward.** Each level softens the message. Where raising problems is unsafe, they surface when they can no longer be hidden.
- **Silos and their opposite.** Twelve units each build their own version of the same capability. Or one central unit builds for all twelve and every request waits in one queue. Both are failures of matching structure to dependency.

### What you must understand

**Conway's observation, precisely.** Conway (1968) argued that a design is produced by people who must communicate to agree on interfaces, so the structure of the design will be a homomorphic image of the organization's communication structure. The claim is about *communication paths*, not about boxes on a chart. Where two groups have no working channel, there will be no well-negotiated interface between their parts, whatever the architecture diagram says.

*The evidence.*
- MacCormack, Baldwin & Rusnak (2012) compared products with the same function built by tightly coupled commercial teams and by loosely coupled open-source communities. The loosely coupled organizations produced measurably more modular designs.
- Colfer & Baldwin (2016) reviewed 142 empirical studies of this "mirroring hypothesis". It was supported in a clear majority of studies of single firms, with systematic exceptions, notably open collaborative projects that use shared tools and visibility to coordinate without matching structure.
- Nagappan, Murphy & Basili (2008) found that measures of organizational structure predicted failure-prone components in Windows Vista better than code metrics did.

*Status.* Well supported as a strong tendency. It is not a law, and it is frequently used rhetorically to justify whatever reorganization is being proposed. The testable content is narrow: look at who actually needs to talk to whom for the design to work, and at whether they can.

*Both directions.* Once a system exists, its modules define the units of work, and teams form around them. Architecture then stabilizes the organization. Changing either alone produces a mismatch.

**Coordination has a theory.** Three classical results fit together.

- **Kinds of interdependence** (Thompson 1967):

  | Type | Description | Adequate coordination | Cost |
  |---|---|---|---|
  | Pooled | Units share a resource or rules but do not feed each other | Standardization | Low |
  | Sequential | One unit's output is another's input | Planning and scheduling | Medium |
  | Reciprocal | Units feed each other, iteratively | Mutual adjustment: direct, continuing communication | High |

- **The information-processing view** (Galbraith 1974). The more uncertain the task, the more information must be processed during execution. An organization can either reduce the need (slack resources; self-contained units that do not depend on others) or increase its capacity (information systems; lateral relations such as liaison roles and cross-functional teams).
- **Coordination as managing dependencies** (Malone & Crowston 1994). Identify the dependencies first (shared resources, producer and consumer, simultaneity, task and subtask), then choose a mechanism for each.

Software development has high task uncertainty (Part III) and reciprocal interdependence within a feature. The theory predicts that only mutual adjustment is adequate inside a feature, and that standardization works between parts only where interfaces are stable (§12). **That is the theoretical basis for small cross-functional teams aligned with modules.** It is also a statement of when that advice does not apply: stable, well-understood, loosely coupled work can be coordinated by plans and standards.

**Brooks's law and its conditions.** Adding people helps when work is partitionable with little communication between the parts, and hurts when it is not. The law's own scope is late addition to a project with sequential constraints. Modular architecture (§11) is what makes work partitionable. Brooks's remedy, small teams with a clear design authority, is a statement about keeping conceptual integrity within what a few minds can share.

**Team design vocabulary.** Skelton & Pais (2019) offer four team types and three interaction modes:

| Team type | Purpose |
|---|---|
| Stream-aligned | Owns a flow of work for a part of the business, end to end |
| Platform | Provides internal services that reduce other teams' load |
| Enabling | Helps other teams acquire a capability, then leaves |
| Complicated-subsystem | Owns a part that needs rare specialist knowledge |

| Interaction mode | Meaning |
|---|---|
| Collaboration | Two teams work together for a period to discover something |
| X-as-a-service | One team consumes what another provides, with little talk |
| Facilitating | One team coaches another |

Their organizing criterion is **team cognitive load** (§16a): a team should own no more than it can understand. The framework is consistent with Galbraith and Conway and gives useful words. It is a practitioner synthesis and has not been empirically validated as such.

**Ownership.** Every module (§11), data set (§10), interface (§12), and running service (§13) needs exactly one owning team with the authority to change it and the obligation to operate it. Shared ownership works inside a team and degrades between teams.

**Distance.** Communication frequency falls steeply with physical distance (Allen 1977). Work items spanning sites took about two and a half times as long as single-site items in one large study, mostly because of delay in finding the right person and getting a response (Herbsleb & Mockus 2003). After the shift to remote work in 2020, a study of about 61,000 Microsoft employees found collaboration networks becoming more static and more siloed, with fewer ties bridging groups (Yang et al. 2022). Remote work preserves communication inside established teams better than it preserves the weak ties through which knowledge moves between teams.

**Conditions for information to flow.**
- *Psychological safety* (Edmondson 1999): the shared belief that one can raise problems, questions, and mistakes without punishment. It predicted learning behaviour in teams.
- *Westrum's typology* (2004): pathological organizations suppress and punish messengers, bureaucratic ones channel information through procedure, generative ones seek it out. He developed the typology in safety research; the DORA programme later adopted it (§13).

**Socio-technical systems.** Trist & Bamforth (1951) studied British coal mines after mechanization. The new technology was introduced with a work organization that fragmented previously self-regulating groups, and performance and morale fell. Their conclusion, that the social and technical systems must be designed together, is the origin of a research tradition and of most arguments for autonomous teams.

**Systems redistribute power.** Markus (1983) studied resistance to an information system and compared three explanations: difficult people, a poor system, or the interaction between the system and the existing distribution of power. Only the third explained which groups resisted and which welcomed it. A system that moves control over information from one unit to another will be supported and opposed accordingly. Requirements are negotiated among parties with different interests, and "resistance to change" usually has a content.

**Inertia.** Organizational structures persist because reliability and accountability favour reproducible routines (Hannan & Freeman 1984). The same properties that make an organization dependable make it slow to change form. The Introduction's remark that organizations can be redrawn in months but resist change longer than code refers to this.

**Organization across contracts.** A supplier's team is part of the communication structure. Contract boundaries are the hardest boundaries of all (§11, ladder of boundary strength). The way a procurement is divided into lots (§22) therefore determines an architecture, whether or not anyone intended it.

**Agents as team members.** *Tentative.* Coding agents raise individual throughput on some work (§16, note). They do not shrink the communication term: the number of humans who must share an understanding is unchanged, and the volume to be reviewed and integrated rises. The bottleneck moves from writing to deciding and verifying, which are the activities most dependent on team structure.

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Grouping | By function or specialty (depth of skill; hand-offs and queues for every feature) | Cross-functional by product or stream (flow; thinner specialist depth; duplicated skills) |
| Shared capabilities | Central team as gatekeeper (consistency; bottleneck) | Platform consumed as a self-service product, or specialists embedded in teams (flow; requires product discipline or more specialists) |
| Autonomy | High local autonomy (speed, fit, motivation; divergence, duplication) | Strong standards (coherence, mobility of people; slower, poorer local fit) |
| Staffing | Stable long-lived teams (retained theory; less flexible) | Project teams (flexible; knowledge lost at each end) |
| Location | Co-located (cheap grounding; restricted hiring) | Distributed (wider hiring; slower cross-team communication; needs deliberate bridging) |
| Size | Few larger teams (fewer interfaces; internal coordination load) | Many small teams (focus; more interfaces to manage, §12) |

### Contested points

- **Conway's law as a law, and the "inverse Conway manoeuvre".** The tendency is well supported. Deliberately reshaping the organization to obtain an architecture is plausible and widely recommended; the evidence for it is case reports.
- **Brooks's law in open source.** Large open-source projects absorb many contributors. Studies have found little or no slowdown from added contributors there. The explanation usually given is extreme modularity and a small core team, which is consistent with Brooks's own conditions.
- **Team Topologies and scaling frameworks.** Popular and coherent. Evidence consists of practitioner accounts. The large scaling frameworks (SAFe and similar) have even less independent support. The much-copied "Spotify model" was described by its own authors as a snapshot of an experiment that the company did not fully follow.
- **Remote and hybrid work.** Individual output measures often hold or rise; cross-group collaboration and learning appear to suffer. Studies conflict, and the settings differ.
- **Psychological safety.** The original research is solid. Its popular use as a universal explanation, often citing an internal Google study that was not peer-reviewed, goes beyond it.

### Examples

**Example 19.1 — Elapsed time versus touch time.** A change to a validation rule:

| Step | Work | Waiting before the step |
|---|---|---|
| Analyst writes change description | 3 h | 4 days (analyst's queue) |
| Development | 5 h | 6 days (sprint boundary) |
| Review | 1 h | 2 days |
| Test team | 3 h | 5 days |
| Release approval | 0.5 h | 8 days (monthly window) |
| Deployment by operations | 1 h | 3 days |

Work: 13.5 hours. Elapsed: about 30 days. Flow efficiency is roughly 6%. Making any step faster changes almost nothing. Removing a hand-off or a queue changes a great deal. This is §7 applied to an organization, and it is typically invisible because each unit reports its own utilization, which is high.

**Example 19.2 — Reading a lot structure with Conway.** A system is procured in four lots: analysis, development, testing, hosting. Predicted architecture of the *work*: four organizations communicating through documents and tickets, with reciprocal interdependence (developer questions about analysis; test findings about development) handled by a mechanism suited to sequential dependence. Predicted outcome: long queues at each boundary, disputes about which lot caused a defect, and a system whose seams follow contract boundaries. The alternative is not "no lots". It is to place contract boundaries where interdependence is pooled or sequential, for example hosting on a standard platform, and to keep reciprocally dependent work inside one team.

### Key literature

1. **Conway, M. E. (1968). "How Do Committees Invent?" *Datamation* 14(4), 28–31.** — *Seminal.* The original argument; short and more careful than its slogan.
2. **Brooks, F. P. (1975). *The Mythical Man-Month*. Addison-Wesley.** (Anniversary ed. 1995.) — *Seminal.* Communication overhead, conceptual integrity, and the law that bears his name.
3. **Galbraith, J. R. (1974). "Organization Design: An Information Processing View." *Interfaces* 4(3).** — *Seminal.* Organization design as matching information-processing capacity to task uncertainty.
4. **Malone, T. W. & Crowston, K. (1994). "The Interdisciplinary Study of Coordination." *ACM Computing Surveys* 26(1).** — *Seminal.* Coordination as the management of dependencies.
5. **Colfer, L. J. & Baldwin, C. Y. (2016). "The Mirroring Hypothesis: Theory, Evidence, and Exceptions." *Industrial and Corporate Change* 25(5).** — *Recent.* The best assessment of the evidence for Conway's observation. With **MacCormack, A., Baldwin, C. & Rusnak, J. (2012). "Exploring the Duality between Product and Organizational Architectures." *Research Policy* 41(8).**
6. **Herbsleb, J. D. & Mockus, A. (2003). "An Empirical Study of Speed and Communication in Globally Distributed Software Development." *IEEE Transactions on Software Engineering* 29(6).** — *Seminal empirical.* What distance costs.

Also: **Cataldo, M., Herbsleb, J. D. & Carley, K. M. (2008). "Socio-Technical Congruence." ESEM '08.** **Nagappan, N., Murphy, B. & Basili, V. (2008). "The Influence of Organizational Structure on Software Quality." ICSE '08.** **Skelton, M. & Pais, M. (2019). *Team Topologies*. IT Revolution.** **Edmondson, A. (1999). "Psychological Safety and Learning Behavior in Work Teams." *Administrative Science Quarterly* 44(2).** **Markus, M. L. (1983). "Power, Politics, and MIS Implementation." *Communications of the ACM* 26(6).** **Trist, E. L. & Bamforth, K. W. (1951). "Some Social and Psychological Consequences of the Longwall Method of Coal-Getting." *Human Relations* 4(1).**

### Self-check questions

1. State Conway's claim in terms of communication paths. For one seam in your architecture where defects cluster, identify the people on both sides and how they actually communicate.
2. Classify the interdependence between analysts and developers on your project as pooled, sequential, or reciprocal. Which coordination mechanism is in use, and does it match?
3. Compute elapsed time and touch time for a recent small change. Where did it wait, and who could see that it was waiting?
4. An organization proposes to centralize all database work in one team to improve quality. Predict the effects using §7 and this set, and propose a design that pursues the same goal differently.
5. A new register will take reporting duties from one department and give visibility to another. Using Markus, predict who will find the requirements "unclear" and why.

---

## 20. Governance

### The constraint

Decisions about software are made by people who do not do the work, on behalf of people who bear the consequences, using information that reaches them late and filtered. Governance is the arrangement of **decision rights, accountability, and information flows** that deals with this.

It faces three structural problems.
- **Agency.** Those who act (teams, suppliers) know more than those on whose behalf they act (sponsors, the public) and have partly different interests.
- **Legibility.** To govern something you must be able to see it. What governors can see is a simplified representation: plans, status reports, metrics, documents. The representation is not the thing.
- **Unobservable quality.** The properties that matter most over a system's life, such as structure, understanding, and fitness for real use, are tacit (§18) and cannot be read from the outside.

### What goes wrong

- **Milestones that measure documents.** Stage gates approve the existence of deliverables. Projects pass every gate and fail at the end.
- **Status reports that stay green.** Each level reports slightly better than it was told. The colour changes when the date is reached.
- **Metrics that are gamed.** Velocity rises by re-estimating. Coverage rises with tests that assert nothing. Response-time targets are met by closing and reopening tickets.
- **Fixing scope, time, and cost together**, before the work is understood, and treating the result as a commitment.
- **Decision rights in the wrong place.** A steering group decides technical questions it cannot evaluate. Or a team decides matters with consequences for other units and nobody else knows.
- **Decision delay.** A question that blocks five people waits three weeks for a monthly board.
- **Accountability without authority.** An architect answers for quality and controls neither staffing nor schedule.
- **Escalation of commitment.** A failing project continues because stopping would be an admission (§16d).
- **Compliance as a substitute for results.** Following the prescribed process becomes the defence. Whether the system works is a separate matter.
- **Project funding without an owner afterwards.** Money exists to build and not to keep (§15, §21).
- **Dates fixed by legislation before analysis.** The law takes effect on 1 January, and the system must exist by then, whatever turns out to be involved.
- **Shared things nobody governs.** A data model or component used by six institutions, with no body that can decide a change (§10, §12).

### What you must understand

**Agency theory in one page.** A *principal* engages an *agent*. The agent has better information and different interests. The principal can contract on **outcomes** or on **behaviour** (Eisenhardt 1989):
- Outcome-based control works when outcomes are measurable and largely within the agent's control.
- Behaviour-based control works when the task is programmable, meaning the right actions can be specified and observed.

Software development scores poorly on both: outcomes are hard to measure and arrive late, and the right actions cannot be specified in advance (Part III).

**Three modes of control.** Ouchi (1979) crossed two questions: can you measure the output, and do you understand the process well enough to prescribe it?

| | Process well understood | Process poorly understood |
|---|---|---|
| **Output measurable** | Either behaviour or output control | Output control (markets, prices, targets) |
| **Output hard to measure** | Behaviour control (rules, procedures, supervision) | **Clan control** |

*Clan control* means selection, socialization, shared professional values, and trust among people who can judge each other's work. Research laboratories, surgical teams, and good engineering groups run this way. Custom software development sits in the lower-right cell. **The control mode that fits it is the one that bureaucratic governance and arm's-length contracting are least able to supply or to purchase.** Much of the friction described in this part follows from applying the instruments of the other three cells.

**What measurement does to behaviour.**
- **Goodhart's law** (1975) and **Campbell's law** (1979): the more a quantitative indicator is used for decisions about people, the more it will be distorted and the more it will distort the activity it was meant to monitor.
- **Kerr (1975)**, "On the folly of rewarding A, while hoping for B": organizations reward what is visible and countable and then are surprised to get it.
- **The multitask problem** (Holmström & Milgrom 1991). When a job has several dimensions and only some can be measured, strong incentives on the measurable ones pull effort away from the others. With quality, maintainability, and knowledge sharing unmeasurable, strong incentives on features or tickets predictably degrade them. The model's conclusion is that weak incentives, such as salary and professional norms, are optimal for such work. This is a formal argument for clan control.

A practical distinction follows: **metrics for learning** (a team examining its own lead times) behave differently from **metrics for judgment** (a manager ranking teams by them). The same number is honest in the first use and corrupted in the second.

**Legibility.** Scott (1998) described how states make societies administrable by simplifying them: standard measures, surnames, cadastral maps. The simplified picture enables administration and omits the local knowledge on which the real activity depends. Schemes that mistook the picture for the activity failed, sometimes catastrophically. The idea applies twice in this article:
- to the governance *of* software projects, where plans, Gantt charts, and requirement counts are the legible picture;
- to software *as* an instrument of state legibility (§23).

Legibility is necessary. The error is to act as though nothing outside the picture matters.

**Where decisions should be made.** Hayek (1945) argued that the knowledge needed for good decisions is largely knowledge of particular circumstances, held by the people on the spot, and cannot be aggregated at the centre. Ashby's law of requisite variety (1956) says the same from control theory: a controller needs as much variety in its responses as the system it controls has in its states. A central body cannot match the variety of local situations.

Against this stands the need for coherence: interoperability, security, shared data definitions, mobility of people. The standard resolution is **federal**: the centre fixes a small number of binding rules, namely the interfaces and standards that Baldwin and Clark call design rules (§11), and everything else is decided locally. Weill & Ross (2004) surveyed IT governance arrangements in several hundred enterprises and catalogued the archetypes (business monarchy, IT monarchy, feudal, federal, duopoly, anarchy), finding that well-performing firms assigned different decision types to different arrangements deliberately.

**Two ways to govern standards.**

| | Governance by policy | Governance by platform |
|---|---|---|
| Mechanism | Rules, review boards, approval | A shared product that makes the compliant way the easy way |
| Enforces | By refusal | By convenience |
| Failure mode | Queue; workarounds; rules without rationale | Platform that does not fit; teams leave it |
| Needs | Authority | Product discipline and funding |

Automated checks (§15, fitness functions) are a third form: the rule is enforced by the pipeline, immediately and without a meeting.

**Evidence of progress.** A sponsor is entitled to know whether the work is converging. Document milestones and percentage-complete figures do not show it. Things that do:

| Instrument | What it shows |
|---|---|
| Working increments in use by real users | That understanding has been tested against practice (§16c) |
| Open questions and risks, counted and aged | Whether unknowns are being retired or accumulating |
| Decision log (§18) | That choices are being made, by whom, and why |
| Validated and invalidated assumptions (W in §17) | Whether domain knowledge is growing |
| Forecast as a range that narrows, or does not | Honest uncertainty; a range that fails to narrow is itself information |
| Flow measures: lead time, items in progress | Where work waits (§19) |

These make the search visible without pretending it is a production line. They are the governance counterpart of Part III: since the specification cannot carry the assurance, the evidence has to come from somewhere else.

**The widely used "cone of uncertainty"**, which shows estimates narrowing by fixed ratios through project phases, is a normative picture. Project data did not show uncertainty shrinking that way without deliberate effort (Little 2006).

**Why public organizations govern defensively.** Wilson (1989) explained public agencies' behaviour by their situation: goals that are multiple and contested, outputs that are hard to observe, and constraints that are highly visible. A public manager is criticized for a visible failure or a breached rule and seldom rewarded for an efficiency gain. Process compliance is the rational response. It is not timidity; it is what the accountability structure pays for.

**Three eras of public management.**
- *Classical bureaucracy:* hierarchy, rules, in-house capacity.
- *New Public Management* (from the 1980s): disaggregation into agencies, competition, performance contracts, outsourcing of functions including IT.
- *Digital-era governance* (Dunleavy et al. 2006): reintegration, services organized around citizens' needs, and digital processes as the core of administration.

Dunleavy and colleagues compared government IT in seven countries. Those that had outsourced most heavily to a few large suppliers and retained least in-house expertise had the poorest record with government IT. The mechanism is absorptive capacity (§18). Several governments later rebuilt internal digital units for that reason.

**Shared resources.** Ostrom (1990) studied communities that manage common resources successfully without either privatization or central control, and identified recurring design principles: clear boundaries of membership and resource; rules fitted to local conditions; participation of users in making the rules; monitoring; graduated sanctions; accessible conflict resolution; recognition by higher authorities; and nesting of governance in layers. Shared platforms, shared data models, and open-source components are commons in this sense, and their failures usually trace to a missing principle, most often that those who depend on the resource have no part in deciding its rules.

**Frameworks.** Standards for security management, service management, and IT control give auditors a common basis and organizations a checklist. The evidence that certification correlates with good outcomes is thin. They provide legibility, which has value, and should not be confused with the property they describe.

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Locus of decisions | Central (coherence; slow; ignorant of local facts) | Local (fit, speed; divergence, duplication); federal arrangements split by decision type |
| Control mode | Rules and procedures (legible, auditable; poor fit to uncertain work) | Professional judgment in trusted teams (fits; hard to audit; depends on selection) |
| Funding release | Stage gates on deliverables (clear checkpoints; rewards documents) | Incremental, against evidence from working software (real information; needs sponsors who engage) |
| Use of metrics | For judgment and reward (gaming) | For diagnosis by the team itself (no external comparability) |
| Standards | By policy (authority; queues) | By platform (adoption by choice; needs investment) |
| Accountability | Individual blame (apparent clarity; concealment) | Shared, with open review (learning; less satisfying to outside critics) |

### Contested points

- **The legacy of New Public Management.** Critics hold it responsible for fragmentation and for hollowing out public technical capacity. Defenders point to cost discipline and to real failures of the in-house monopolies it replaced. Dunleavy and colleagues' comparative evidence on IT supports the critics.
- **Centralizing government IT.** Economies of scale in infrastructure are real. In domain applications the evidence for scale economies is weak and the queueing cost of a monopoly supplier is strong (§19, §21). Each consolidation programme is argued from the first fact and experienced through the second.
- **Enterprise architecture frameworks.** Extensive frameworks exist and are widely mandated. Independent evidence of benefit is scarce, and some researchers argue that the documented practice is rarely followed even where it is claimed.
- **Metrics in governance.** One side: what is not measured is not managed. The other: Goodhart. Holmström and Milgrom's analysis explains when each is right.
- **Agile governance in the public sector.** Advocates report better outcomes from incremental funding. Sceptics note the tension with budgeting, audit, and procurement rules (§22). The tension is real; whether it is resolvable within existing law is addressed in §22.

### Examples

**Example 20.1 — Placing work in Ouchi's matrix.**

| Activity | Output measurable? | Process understood? | Fitting control |
|---|---|---|---|
| Hosting on a standard platform | Yes (availability, latency) | Yes | Output targets in a contract (SLA) |
| Running a batch of data corrections to a known rule | Yes | Yes | Either |
| Upgrading a framework version | Mostly | Mostly | Output, with technical acceptance |
| Building a new case-handling system | Late and partially | No | Clan: a trusted team, continuous evidence |
| Deciding what the system should do | No | No | Clan, with the domain inside the team |

One organization needs all of these. The common error is a single governance regime, usually the one designed for the first row, applied to every row.

**Example 20.2 — Two status reports for the same week.**

*Report A:* Analysis 100%. Development 62%. Testing 15%. Overall status: green. On schedule.

*Report B:* In production use by twelve case handlers since March; they completed 340 cases in it this week. Open questions: 9, of which 3 older than a month (both lists attached). Two domain assumptions invalidated this month: representatives can act for several principals; deadlines move when they fall on public holidays. Forecast for full roll-out: September to December, unchanged from last month, because of the three old questions, which await a ministry decision.

Report A is legible and uninformative. Report B is legible and tells the sponsor what they can do: get three decisions made.

### Key literature

1. **Eisenhardt, K. M. (1989). "Agency Theory: An Assessment and Review." *Academy of Management Review* 14(1).** — *Seminal.* The clearest statement of when to control by outcome and when by behaviour.
2. **Ouchi, W. G. (1979). "A Conceptual Framework for the Design of Organizational Control Mechanisms." *Management Science* 25(9).** — *Seminal.* Markets, bureaucracies, and clans.
3. **Holmström, B. & Milgrom, P. (1991). "Multitask Principal–Agent Analyses: Incentive Contracts, Asset Ownership, and Job Design." *Journal of Law, Economics, & Organization* 7.** — *Seminal.* Why strong incentives on measurable tasks harm unmeasurable ones.
4. **Hayek, F. A. (1945). "The Use of Knowledge in Society." *American Economic Review* 35(4).** — *Seminal.* Dispersed knowledge and the limits of central decision.
5. **Scott, J. C. (1998). *Seeing Like a State*. Yale University Press.** — *Seminal.* Legibility, its uses, and its failures.
6. **Dunleavy, P., Margetts, H., Bastow, S. & Tinkler, J. (2006). *Digital Era Governance: IT Corporations, the State, and e-Government*. Oxford University Press.** — *Recent.* Comparative evidence on how the organization of government IT affects its results.

Also: **Ostrom, E. (1990). *Governing the Commons*. Cambridge University Press.** **Wilson, J. Q. (1989). *Bureaucracy*. Basic Books.** **Kerr, S. (1975). "On the Folly of Rewarding A, While Hoping for B." *Academy of Management Journal* 18(4).** **Weill, P. & Ross, J. W. (2004). *IT Governance*. Harvard Business School Press.** **Campbell, D. T. (1979). "Assessing the Impact of Planned Social Change." *Evaluation and Program Planning* 2(1).**

### Self-check questions

1. Place three activities you are involved in into Ouchi's matrix. Which control mode is actually applied to each?
2. Name a metric in your environment that is used to judge people or suppliers. Using Holmström and Milgrom, predict what it crowds out, and check whether that has happened.
3. A steering group meets monthly and decides all architecture questions. Apply Hayek and Ashby. Then say which architecture decisions *should* be made centrally and why.
4. Rewrite your project's last status report in the form of Report B. Which items could you not fill in?
5. A component is shared by several institutions and nobody can get a change agreed. Which of Ostrom's principles are missing?

---

## 21. Economics

### The constraint

Software is expensive to create and nearly free to copy. It is not free to run, and it is never finished. Four economic facts shape everything else.

- **Value is uncertain, arrives late, and often accrues to parties other than the payer.**
- **Costs are heavy-tailed.** A minority of efforts overrun enormously, and the average conceals this.
- **Quality is invisible to the buyer.** Structure, security, and maintainability cannot be seen at purchase (§20).
- **Knowledge of a custom system is an asset specific to that system and held by particular people** (§18). Whoever holds it has bargaining power.

And resources are finite, so every choice displaces another.

### What goes wrong

- **Estimates treated as promises.** A most-likely figure becomes a budget, then a commitment, then a failure.
- **Budgets fixed before understanding.** Annual budgeting and grant applications require scope, duration, and cost at the moment of greatest ignorance.
- **Build funded, upkeep not.** Investment budgets and many grant schemes pay for creation. Operation and change, the larger share of lifetime cost, must be found elsewhere or are not found.
- **Lowest price wins.** With quality unobservable, price is what can be compared, and good suppliers cannot recover the cost of being good.
- **Comparing hourly rates.** Rates vary by tens of percent. Productivity on the same task varies several-fold (§16e).
- **Full utilization of people.** Everyone is busy, and everything waits (§7, §19).
- **Large projects.** Risk grows faster than size. The big-bang delivery concentrates it in one date.
- **Lock-in discovered late.** The supplier, the platform, or the two people who understand the system turn out to be irreplaceable at any reasonable price.
- **Sunk-cost reasoning.** "We have already spent four million" (§16d).
- **Benefits never checked.** The business case justified the investment; nobody returns to it.
- **Unpaid infrastructure.** Critical open-source components maintained by volunteers (§14, xz).
- **Duplicate systems** across units, and the opposite error, forced reuse that fits nobody.

### What you must understand

**The structure of cost over a system's life.**

| Phase | Driver | Note |
|---|---|---|
| Initial development | People | The visible part |
| Operation | Infrastructure, licences, support, incidents (§1, §13) | Recurs; scales with use |
| Change | People, slowed by accumulated structure (§15) | Usually the largest share over a long life; commonly cited ranges are 40–80% of lifetime cost, from old and heterogeneous sources **[verify before quoting a figure]** |
| Exit | Migration, archival, decommissioning (§10) | Rarely budgeted |

Lifetime cost is roughly proportional to size × rate of change × years. Every feature has a carrying cost. The cheapest feature is the one not built, and the second cheapest is the one removed (§15).

**Estimates are distributions.** Effort for a task is bounded below and has a long upper tail. Three consequences:
- The mean exceeds the median, so "most likely" figures summed across tasks understate the expected total (Example 21.1).
- Tasks are correlated: the same misunderstood requirement or weak platform slows many of them. Correlation widens the total's distribution.
- A single number hides the only thing a sponsor needs for planning, which is the spread.

**What the evidence says about estimation.**
- Expert judgment is about as accurate as formal estimation models, and more accurate when the experts have relevant history and use it (Jørgensen 2004, review).
- Surveys of projects, excluding the discredited Standish figures (§17), put average cost overrun around 30% (Moløkken & Jørgensen 2003, review).
- Flyvbjerg & Budzier (2011) examined 1,471 IT projects. The average overrun was 27%. One project in six, however, had a cost overrun of about 200% on average with schedule overrun near 70%. **The tail, not the average, is the risk.**

**The outside view and its limits.** Reference-class forecasting (Kahneman & Lovallo 1993; applied to large projects by Flyvbjerg) estimates from the distribution of outcomes of similar past efforts instead of from the plan (§16d). It corrects optimism reliably. Its difficulties are real: choosing the class is a judgment that can be bent; software projects are heterogeneous; and a distribution is not a plan. It should be used to set the range and the contingency, and the inside view to do the planning.

**Why forecasts err: three explanations.**
- *Psychological:* the planning fallacy (§16d).
- *Political-economic:* strategic misrepresentation. Projects compete for approval, and the ones with optimistic numbers win (Flyvbjerg).
- *Benign:* Hirschman's "hiding hand" (1967) proposed that underestimating difficulty is useful, because we also underestimate our ability to respond, and worthwhile ventures would otherwise not start. Flyvbjerg & Sunstein (2016) tested the idea on a large sample and found that the costs are typically underestimated more than the benefits. The debate is not closed, and critics have challenged both Flyvbjerg's explanation and his data.

**Essence and accident.** Brooks (1986) divided the difficulty of software into *essential* complexity, which is inherent in the conceptual structure of what is being built, and *accidental* complexity, which comes from our tools. He argued that most accidental difficulty had already been removed, so no single development would yield a tenfold improvement within a decade. That prediction held for about forty years. AI coding agents are the current candidate. They plainly reduce accidental work. Whether they touch the essential part, which is deciding what to build and understanding it (Part III), is the open question, and the METR result (§16, note) suggests caution. **Tentative.**

**Queues and delay.** Reinertsen (2009) applied queueing theory (§7) to product development:
- Work waiting in queues is invisible inventory. It costs money through delay and delivers nothing.
- **Cost of delay** is the value lost per unit of time that something is not delivered. Sequencing work by cost of delay divided by duration minimizes total delay cost (Example 21.3).
- **Batch size** trades transaction cost per batch against holding cost. Automation lowers transaction cost and makes small batches economical. Small batches shorten feedback and reduce variance.
- **High utilization causes long queues**, nonlinearly. Capacity kept free is not waste where response time has value.

The reasoning is sound mathematics applied to development. Direct empirical validation in software is limited.

**Options.** Under uncertainty, the ability to decide later has value. Modularity (§11), prototypes, incremental delivery, and reversible choices are *real options*: each costs something now and pays off if what is learned later makes a different course preferable (Baldwin & Clark 2000; Sullivan et al. 1999). The more uncertain the situation, the more an option is worth. Big up-front commitment is rational when uncertainty is low and irrational when it is high.

**Make or buy: transaction-cost economics.** Coase (1937) asked why firms exist when markets could coordinate everything. His answer: using the market has costs, namely finding partners, negotiating, writing contracts, and enforcing them. Williamson (1985) identified when those costs become prohibitive:

| Factor | Meaning | Custom system for a public register |
|---|---|---|
| **Asset specificity** | Investments worth much more inside this relationship than outside | High: knowledge of the domain, the code, the neighbouring systems |
| **Uncertainty** | Future contingencies cannot be foreseen and written down | High (Part III) |
| **Frequency** | The transaction recurs | Continuous change over decades |

When all three are high, market contracting fails in a specific way. Williamson called it the **fundamental transformation**: before award there are many bidders; after award the winner has acquired specific knowledge that no rival has, and the relationship has become a bilateral monopoly. Either party can then exploit the other (*hold-up*). The supplier can overcharge for changes; the buyer can squeeze a supplier who has invested.

This is Naur (§16e) expressed in economics. The theory held by the incumbent team is a relationship-specific asset. The prediction is that such work will be governed by hierarchy (in-house teams) or by long-term relational contracts, and that arm's-length competitive contracting will perform badly. That prediction should be kept in mind throughout §22.

**Incomplete contracts.** Since not every contingency can be specified (§17), contracts are necessarily incomplete, and what matters is who holds the right to decide in the unforeseen cases (Grossman & Hart 1986; Hart & Moore 1990). Hart, Shleifer & Vishny (1997) applied this to public services. A private contractor has a strong incentive to reduce cost, including by reducing any quality that the contract cannot specify. An in-house provider has weaker incentives of both kinds. So in-house provision is preferable **when non-contractible quality matters a great deal and cost-cutting can damage it**. Maintainability, security, and fitness for actual use are non-contractible qualities of software.

**Lemons.** Akerlof (1970) showed that when sellers know quality and buyers do not, buyers will pay only for average quality, good sellers withdraw, average quality falls, and the market can unravel. Markets for custom development have this structure. Remedies are signals and screens: demonstrated work, trial assignments, references that can be checked, reputation over repeated dealings. Selecting on price is the mechanism of unravelling made into policy.

**Lock-in and switching costs.** Shapiro & Varian (1999) set out the economics: a supplier can charge up to the buyer's cost of switching, so suppliers compete hard to win and recover the investment afterwards. Switching costs in software include data migration, retraining, integration rework, and above all lost understanding. Open standards, data portability, owned source code, and in-house knowledge lower them. None of these is free.

**Scale.** Projects show *diseconomies* of scale: effort grows more than proportionally with size in the standard cost models (Boehm et al. 2000), though data sets differ **[verify]**, and risk grows with size and duration more clearly than effort does. Operations show economies of scale in infrastructure. Reuse promises economies of scope and delivers less than hoped, because of fit and coordination costs (§11, §19).

**Public value and externalities.** The benefits of public systems are spread across citizens and other institutions and do not return to the paying unit's budget. A unit therefore under-invests in what mainly helps others: interoperability, data quality for downstream users, shared components. The same logic explains under-investment in security (§14) and in open-source infrastructure.

**Baumol's cost disease.** Wages in labour-intensive work rise with the general wage level even where productivity does not. Public-sector pay scales lag the market for software skills, so public bodies cannot hire, and they buy the same skills through contracts at a premium. This is an economic cause of the loss of in-house capacity, separate from any policy preference for outsourcing.

**Accounting shapes architecture.** Rules for capitalizing development, for separating investment from running cost, and for grant eligibility reward packaging work as discrete projects with an end. Systems that need continuous change are distorted to fit.

**Productivity cannot be read from a number.** Lines of code, function points, story points, and commits each fail as measures. The SPACE framework (Forsgren et al. 2021) proposes observing several dimensions together: satisfaction, performance, activity, communication, and efficiency. It is a caution against single metrics more than a solution. Claims about AI-driven productivity should be read with this in mind and with attention to who funded the study.

**Forecasts of value are poor too.** In large-scale online experiments at Microsoft, only about a third of ideas tested improved the metric they were meant to improve (Kohavi et al. 2009). The people proposing them were experienced. The largest economic risk is building the wrong thing competently, which is the economic expression of §17.

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Sourcing | In-house (retains theory and steering ability; hiring and pay constraints; fixed capacity) | External (flexible capacity; hold-up and knowledge loss; needs strong client capability) |
| Product | Custom build (fit; full lifetime cost; specific assets) | Standard product or SaaS (shared cost; adapt the organization to it; vendor lock-in) |
| Pricing | Fixed price (budget certainty on paper; supplier prices risk and resists change) | Time and materials (flexible; buyer carries risk and must be able to direct the work) |
| Delivery size | Large project (one decision; concentrated tail risk) | Increments (options, early evidence; more decisions; harder to fund under project rules) |
| Capacity | High utilization (looks efficient; long queues) | Slack (fast response; looks idle) |
| Quality investment | Now (slower features; invisible to funders) | Later (interest paid on every change, §15) |
| Reuse across units | Shared component (scope economies; coordination, fit, governance, §20) | Separate builds (fit and speed; duplicated cost) |

### Contested points

- **Planning fallacy, strategic misrepresentation, or hiding hand.** Three explanations of overruns with different remedies: debias, change incentives, or accept. The evidence favours the first two for large projects, with continuing dispute about data and interpretation.
- **Reference-class forecasting.** Demonstrably better calibrated than inside-view estimates in the domains studied. Critics note that class selection is discretionary and that software lacks the homogeneous classes of road or rail projects.
- **Whether to estimate at all.** One camp holds that estimates cost more than they return and that forecasting from measured throughput is enough. The other holds that investment decisions need magnitudes before work starts. They are discussing different decisions.
- **The share of maintenance in lifetime cost** and **diseconomies of scale.** Both are widely cited with figures that trace back to few, old data sets.
- **In-house versus outsourced public IT.** Transaction-cost and incomplete-contract theory favour in-house provision for specific, uncertain work. The counter-argument rests on public-sector hiring constraints and on past failures of internal IT departments. The comparative evidence in §20 sides with retaining substantial internal capacity.
- **AI and development cost.** Vendor studies report large gains; the one randomized trial on experienced developers in familiar code found a loss. **Tentative**; the answer is probably that it depends on the kind of work.

### Examples

**Example 21.1 — Why the sum of likely values is unlikely.** Ten tasks. Each is estimated at 5 days, meaning that is its median. Each follows a right-skewed distribution with a mean of 6.5 days (a lognormal with σ ≈ 0.72).

| Quantity | Value |
|---|---|
| Sum of the estimates | 50 days |
| Expected total | 65 days |
| 80th percentile of the total, tasks independent | about 80 days |
| Probability of finishing within 50 days | roughly 1 in 5 |

If the tasks share causes of delay, the spread is wider still. Nobody was wrong about any task. The plan of 50 days was never the expected outcome. (Figures are from the stated distribution under a normal approximation to the sum, rounded.)

**Example 21.2 — Classifying sourcing decisions with transaction-cost economics.**

| Work | Specificity | Uncertainty | Indicated governance |
|---|---|---|---|
| Hosting, standard infrastructure | Low | Low | Market contract, competitive, measurable |
| Commodity software (office, e-mail) | Low | Low | Buy standard product |
| A security audit | Low to medium | Medium | Market, on reputation |
| Building and evolving a core register or case system | High | High | In-house core team, or a long relational contract with client-held knowledge |
| Deciding what the system should do | Very high | Very high | In-house; cannot be bought |

**Example 21.3 — Sequencing by cost of delay.**

| Item | Cost of delay per week | Duration | Ratio |
|---|---|---|---|
| A: legal change effective in 3 months, penalties if late | 40 | 8 weeks | 5 |
| B: removes a manual step costing staff time | 10 | 1 week | 10 |
| C: new report requested by management | 3 | 2 weeks | 1.5 |

Order B, A, C. Doing the one-week item first costs A one week of delay and removes B's cost for the following eight. The exercise is useful mainly because it forces someone to state what delay costs, which is usually the first time anyone has.

### Key literature

1. **Brooks, F. P. (1987). "No Silver Bullet: Essence and Accidents of Software Engineering." *IEEE Computer* 20(4).** (First presented 1986.) — *Seminal.* The essential/accidental distinction and the productivity prediction.
2. **Williamson, O. E. (1985). *The Economic Institutions of Capitalism*. Free Press.** With **Coase, R. H. (1937). "The Nature of the Firm." *Economica* 4(16).** — *Seminal.* Transaction costs, asset specificity, and the fundamental transformation.
3. **Akerlof, G. A. (1970). "The Market for 'Lemons': Quality Uncertainty and the Market Mechanism." *Quarterly Journal of Economics* 84(3).** — *Seminal.* Why unobservable quality drives quality out.
4. **Hart, O., Shleifer, A. & Vishny, R. W. (1997). "The Proper Scope of Government: Theory and an Application to Prisons." *Quarterly Journal of Economics* 112(4).** — *Seminal.* When non-contractible quality argues for in-house provision.
5. **Flyvbjerg, B. & Budzier, A. (2011). "Why Your IT Project May Be Riskier Than You Think." *Harvard Business Review* 89(9).** — *Recent.* The fat tail of IT project overruns. For the method: **Kahneman, D. & Lovallo, D. (1993). "Timid Choices and Bold Forecasts." *Management Science* 39(1).**
6. **Jørgensen, M. (2004). "A Review of Studies on Expert Estimation of Software Development Effort." *Journal of Systems and Software* 70(1–2).** — *Seminal empirical review.* What is actually known about estimation accuracy.

Also: **Reinertsen, D. G. (2009). *The Principles of Product Development Flow*. Celeritas.** **Shapiro, C. & Varian, H. R. (1999). *Information Rules*. Harvard Business School Press.** **Boehm, B. W. (1981). *Software Engineering Economics*. Prentice Hall.** **Forsgren, N., Storey, M.-A., Maddila, C., Zimmermann, T., Houck, B. & Butler, J. (2021). "The SPACE of Developer Productivity." *ACM Queue* 19(1).** **Kohavi, R., Crook, T. & Longbotham, R. (2009). "Online Experimentation at Microsoft."** (workshop paper). **Flyvbjerg, B. & Sunstein, C. R. (2016). "The Principle of the Malevolent Hiding Hand." *Social Research* 83(4).**

### Self-check questions

1. A plan sums most-likely estimates for forty tasks. Explain to a sponsor, without formulas, why the plan date is unlikely to be met even if every estimate is honest.
2. Using Flyvbjerg and Budzier's finding, explain why "average overrun 27%" is a misleading basis for setting contingency. What would you set it on?
3. Describe the fundamental transformation for a system you know. Who holds the specific assets now, and what would switching cost?
4. Apply Hart, Shleifer and Vishny: name three qualities of a software system that a contract cannot specify, and what a cost-minimizing supplier will do about each.
5. Your organization selects suppliers mainly on hourly rate. State Akerlof's prediction, and propose two screening mechanisms that reveal quality.
6. Which of your current work items has the highest cost of delay? Did anyone state it before you were asked?

---

## 22. Law and procurement

### The constraint

Software is built and operated under rules made by institutions for their own purposes. Three features of those rules bind.

- **Law is text applied by interpretation.** It has every property of §17: open texture, dependence on purpose and context, and an authoritative interpreter (a court or supervisory authority) that speaks only after the fact.
- **Public bodies may do only what law permits, and must buy by prescribed procedure.** Procurement rules exist to secure equal treatment, transparency, and competition, and to prevent corruption. Producing good software is not among their objectives.
- **Contracts must be written before the work, and they are incomplete** (§21). What the parties could not foresee is settled by the allocation of rights and by their relationship.

Legal obligations are constraints of the non-negotiable kind described in the Introduction. A statutory effective date is as fixed as a physical constant for the team that must meet it.

### What goes wrong

**In procurement.**
- **The specification must exist before the supplier does.** The tender describes what is to be built at the point when least is known, in the form that Part III showed cannot carry the meaning.
- **Price dominates the award.** Quality criteria are harder to define and to defend against challenge, so they receive little weight (§21, lemons).
- **Change after award is legally risky.** A substantially modified contract may have to be re-tendered. Learning during the project then has no lawful outlet, or takes the form of disputed change requests.
- **Periodic re-tendering.** Framework agreements normally run at most four years. Each renewal risks either losing the team that understands the system (§18) or confirming an incumbent whom nobody can effectively challenge (§21, fundamental transformation).
- **Lots that cut through reciprocal work** (§19, Example 19.2).
- **People named in the bid are replaced after the award.**
- **Competence that cannot be verified on paper.** Certificates, years of experience, and reference lists are what can be checked. They correlate weakly with ability to do this work.
- **Acceptance against the specification.** The system is accepted because it matches the document, and is unusable.
- **Penalty clauses.** They produce legally defensive behaviour and teach both sides to argue about the text.
- **Rights and exit left vague.** Who owns the code, the build pipeline, the data, the documentation? What must the outgoing supplier do, and for how long?

**In substantive law.**
- **Retrofitted data protection.** Purpose limitation, minimization, retention, and deletion discovered at the end (§10).
- **Erasure against immutable stores.** Event logs, backups, and audit trails that cannot forget.
- **Automated decisions without a legal basis**, or without the explanation and human review that law requires.
- **Legislation that cannot be implemented as written.** Ambiguous, contradictory, or dependent on data that no register holds, with the effective date already fixed.
- **Developers interpreting law.** Where the text is silent, the code decides, and the decision is taken by whoever is writing that function (§17, §23).
- **Licences.** Copyleft obligations triggered unknowingly. A dependency that changes to commercial terms (§15).
- **Accessibility treated as optional** when it is a legal requirement for public bodies.

### What you must understand

**Why procurement law is as it is.** EU public procurement is governed by Directive 2014/24/EU and its national implementations. Its principles are equal treatment, non-discrimination, transparency, and proportionality. It serves the single market and the prevention of favouritism. It achieves these by making decisions *rule-bound and reviewable*: criteria announced in advance, award by those criteria, and a right of challenge for losing bidders.

That design optimizes for procedural fairness and auditability. It works well for goods that can be specified. It fits poorly with something whose specification emerges during production and whose quality cannot be observed at award. Kelman (1990) made the general argument from US federal experience: rules designed to prevent corruption and favouritism also prevent officials from using judgment, including the judgment that a known supplier does better work.

**What contract theory says about complex purchases.** Bajari & Tadelis (2001) analysed the choice between fixed-price and cost-plus contracts. Their result: when the product is simple and can be fully designed in advance, fixed price with competitive bidding is efficient. When the product is complex and the design is necessarily incomplete, the cost of renegotiating a fixed-price contract outweighs its incentive benefits, and cost-plus contracts with negotiated award perform better. Their evidence came from construction, where private buyers overwhelmingly negotiate complex projects instead of auctioning them. Custom software is at the complex end. Public buyers are steered toward the instrument suited to the simple end.

**Contracts in practice are relational.** Macaulay (1963) interviewed businesses about how they actually handle agreements and disputes. They seldom planned in detail or invoked contractual rights. Continuing relationships, reputation, and the prospect of future business did the work, and the formal contract was a last resort. Private buyers of software lean on exactly this. A public buyer is restricted in doing so: equal treatment limits rewarding a supplier for past performance, and each award starts formally afresh. **The public sector is denied the mechanism that mostly governs quality in private contracting.** This is one of the more important and less noticed facts in the field.

**What the directive permits.** More than cautious practice usually assumes. The following are provisions of Directive 2014/24/EU; national law and case law determine how they apply **[verify details against current law before relying on any of them]**.

| Instrument | Use |
|---|---|
| Competitive procedure with negotiation; competitive dialogue | For needs that cannot be met without adaptation or design. Allows discussion with bidders before final tenders |
| Innovation partnership | Development and subsequent purchase in one procedure |
| Award by best price–quality ratio | Quality criteria may include the organization, qualification, and experience of the staff who will perform the contract, where their quality significantly affects performance (Art. 67) |
| Review clauses | Modifications are allowed without a new procedure if provided for in the original documents in clear, precise, and unequivocal terms (Art. 72) |
| Framework agreements | Repeated call-offs under one award, normally up to four years (Art. 33) |
| In-house and public–public cooperation | Awards to an entity the authority controls, or cooperation among authorities, fall outside the procedures under stated conditions (Art. 12) |

A revision of the EU procurement directives has been under preparation **[verify status]**.

**Designing a contract for learning.** The conflict between fixed specification and discovery (Part III) can be reduced within the rules by changing *what is bought*:

| Buy | Structure | Risk borne mainly by |
|---|---|---|
| A defined result | Fixed price, fixed scope | Supplier, who prices it and resists change |
| Capacity toward stated goals | Team or time-based pricing; scope managed by the client through a prioritized backlog; review clause describing how scope evolves | Client, who must be able to direct the work |
| Capacity with a ceiling | As above, with a budget cap and periodic exit points | Shared |
| A target with shared variance | Target cost; savings and overruns split by formula | Shared, by design |

Each row needs something from the client. The second and third need a client who can steer, prioritize, and judge quality, which means retained in-house capability (§18, absorptive capacity). A client without it will be safer, though not well served, with the first row.

**Making competence observable.** If the award must rest on verifiable criteria, the criteria should be evidence of ability and not proxies for it:
- practical assignments carried out by the proposed team and assessed against published criteria;
- interviews with the people who will actually work;
- contractual consequences for replacing them;
- short paid pilot phases with several suppliers before the main award.

Whether and how each is admissible depends on national law and on how the evaluation method is specified in advance **[verify]**. The underlying point comes from §21: these are screening mechanisms against the lemons problem.

**Rights and exit.** Decide at the outset, and write down:
- ownership or unrestricted licence of source code, build and deployment automation, tests, and documentation;
- access to repositories and environments throughout, not at the end;
- data in open formats on demand;
- a funded transition period with joint work (§18, Example 18.1).

None of this transfers understanding. It preserves the conditions under which understanding can be rebuilt.

**Data protection as design input.** The General Data Protection Regulation (Regulation (EU) 2016/679) turns several architectural properties into legal duties.

| Principle | Design consequence |
|---|---|
| Lawful basis and purpose limitation | Each data set has a recorded purpose; reuse for another purpose is a decision, not a query (§10) |
| Data minimization | Collect and replicate less; fewer copies in logs, caches, test environments |
| Storage limitation | Retention periods per category; deletion and archival built, not promised |
| Rights of access, rectification, erasure | Ability to find all data about a person across stores. For public tasks based on law, erasure is limited, but the question must be answerable |
| Security of processing | §14 |
| Data protection by design and by default (Art. 25) | These decisions belong in the architecture phase |
| Automated individual decisions (Art. 22) | Decisions with legal or similarly significant effect based solely on automated processing need a specific legal basis and safeguards, including human intervention and the ability to contest |
| Accountability | Records that demonstrate all of the above |

**Administrative law reaches into architecture.** Principles of good administration typically include a legal basis for every act, a duty to give reasons, a right to be heard, proportionality, and review. For a system that prepares or makes decisions, these become requirements: record which rule version and which data produced each decision (§10, bitemporal); generate an explanation a person can understand; provide a route to a human with real authority to decide otherwise (§23).

**A growing body of EU law addresses software directly.** By number, with dates to be checked **[verify all application dates]**:

| Instrument | Subject |
|---|---|
| Directive (EU) 2016/2102 | Accessibility of public-sector websites and mobile applications |
| Directive (EU) 2019/882 | Accessibility of many private-sector products and services, applying from 2025 |
| Regulation (EU) No 910/2014 as amended by Regulation (EU) 2024/1183 | Electronic identification and trust services; European digital identity wallets |
| Directive (EU) 2022/2555 (NIS2) | Cybersecurity risk management and incident reporting for essential and important entities |
| Regulation (EU) 2024/2847 (Cyber Resilience Act) | Security requirements and vulnerability handling for products with digital elements; phased application to 2027 |
| Regulation (EU) 2024/1689 (AI Act) | Risk-based rules for AI systems; phased application from 2025; several public-sector uses are classed as high-risk; transparency duties for systems that interact with people |
| Regulation (EU) 2024/903 (Interoperable Europe Act) | Interoperability assessments for public-sector digital services |
| Directive (EU) 2024/2853 | Revised product liability, extending to software |

Two shifts are worth noting. Liability for software defects and insecurity is moving toward producers, which changes the economics described by Anderson (§14). And compliance is becoming a substantial fixed cost, which favours large suppliers and weighs on small ones and on volunteer-maintained open source.

**Law as a specification language.** Legislation has the properties of any natural-language specification (§17), with some that are deliberate. Vague terms ("without undue delay", "justified cases") delegate judgment to the official and the court. Hart's open texture is a feature that lets general rules meet unforeseen cases. Automation requires every case to be decided in advance and so removes the delegation, unless the system is designed to hand such cases to a person.

**Rules as code and digital-ready legislation.** Two related movements:
- Drafting legislation with implementation in mind: clear concepts, consistent definitions, reliance on existing registers, and early involvement of implementers. Denmark adopted such principles as policy in 2018.
- Producing a machine-executable version of rules alongside the legal text, ideally during drafting, so that each can be tested against the other (OECD 2020; New Zealand's "Better Rules" work; the Catala language, §17).

The benefit shown so far is earlier discovery of contradictions and gaps in the draft. The limits are those of §17: encoding forces choices where the text is open, and those choices need legal authority behind them.

**Lessig's frame.** Behaviour is regulated by law, social norms, markets, and architecture, and in digital systems the architecture is code (Lessig 1999). A rule built into a system is enforced automatically, in advance, with no room to disobey and no moment at which an official weighs the circumstances. This property is why legal constraints on systems are being written (this set), and why the systems' own regulatory effect needs examining (§23).

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Object of purchase | Defined deliverable at fixed price (apparent certainty; change is conflict) | Capacity with managed scope (adapts; client must steer and can overspend) |
| Award basis | Price-weighted (easy to defend; selects for low quality) | Quality-weighted with practical assessment (harder to design and defend; selects for ability) |
| Lot structure | Many specialized lots (competition per specialty; hand-offs by contract) | One team across analysis, build, and test (flow; larger single award; dependence) |
| Duration | Short terms, frequent competition (price pressure; repeated knowledge loss) | Long relationship (retained theory; weak competitive pressure; needs other controls) |
| Provision | In-house or controlled entity (no procurement for the core; hiring and pay constraints) | Market (capacity on demand; all of the above) |
| Open texture in rules | Encode one interpretation (uniform, automatic; discretion removed) | Route unclear cases to an official (lawful discretion kept; slower; less uniform) |
| Personal data in logs and events | Record freely (diagnosis, audit; deletion and minimization problems) | Minimize and separate (compliant by construction; harder investigation) |

### Contested points

- **Can agile development be procured lawfully?** Many procurement lawyers advise fixed specifications as the safe course. Others point to the negotiated procedures, review clauses, and staff-quality criteria listed above and to authorities that use them. The directive's text supports the second view; the risk appetite of contracting authorities often follows the first.
- **Fixed price.** Buyers value budget certainty. Bajari and Tadelis's analysis, and much experience, indicate that for incompletely specifiable work the certainty is illusory and paid for in change disputes.
- **Use of past performance in awards.** It is the best predictor available and conflicts with opening competition to new entrants. Jurisdictions differ in how much they allow.
- **In-house provision.** The legal route exists. The dispute is the one in §20 and §21.
- **Rules as code.** See §17: earlier error detection against displaced interpretive authority.
- **Regulation of AI and of product security.** Supporters see necessary accountability. Critics see compliance burdens that entrench large firms and weigh on open source. The effects will be visible only after several years of application.
- **Digital sovereignty.** Whether public data and systems may depend on providers subject to foreign jurisdiction is contested on legal, security, and economic grounds, and the legal position has shifted more than once.

### Examples

**Example 22.1 — Two tenders for the same system.**

| | Tender A | Tender B |
|---|---|---|
| Object | "System according to Annex 1 (310 pages)" | "Development capacity to achieve the goals in Annex 1 (12 pages) and to maintain the result" |
| Price | Fixed total | Rate per team-month; ceiling for the contract; exit points every six months |
| Award | 70% price, 30% description of approach | 40% price, 60% quality: practical assignment by the named team, interviews |
| Change | Change-request procedure, priced case by case | Review clause: the client reprioritizes the backlog within the stated goals and ceiling |
| Staff | CVs in the bid | Named team; replacement only with equivalent, assessed people |
| Acceptance | Conformity with Annex 1 | Increments in use; quality criteria (tests, security, documentation of decisions) |
| Client role | Approve documents | Product owner and at least two engineers in the team |
| Exit | Handover of code and documents | Continuous access to everything; funded three-month joint transition |

Tender A is easier to run and to defend. It buys the conduit model of §17 and the knowledge loss of §18. Tender B is harder to prepare and requires a capable client. It should be reviewed against current national law before use **[verify]**.

**Example 22.2 — Erasure and an event store.** Personal data has been written into immutable events. An erasure or retention obligation arrives.

| Design | Mechanism | Cost |
|---|---|---|
| Keep personal data out of events | Events carry identifiers; personal data lives in a mutable store | Must be designed from the start; reads need a join |
| Per-subject encryption keys | Delete the key to make the data unreadable | Key management; legal acceptance as erasure is not uniform **[verify]** |
| Rewrite the stream | Copy the stream, transforming or dropping events | Breaks the immutability on which projections and audit rely; operationally heavy |
| Rely on a legal basis for retention | Public-task or archival grounds limit the right to erasure | Only where the law in fact provides it; retention period still applies |

The first is cheap on the first day and very expensive on any later one. That asymmetry is the reason data-protection questions belong in the architecture phase.

### Key literature

1. **Directive 2014/24/EU of the European Parliament and of the Council on public procurement.** — *Primary source.* Read Articles 12, 26–33, 67, and 72 in the original.
2. **Bajari, P. & Tadelis, S. (2001). "Incentives versus Transaction Costs: A Theory of Procurement Contracts." *RAND Journal of Economics* 32(3).** — *Seminal.* Why complex, incompletely designed projects call for negotiation and cost-plus contracts. See also **Tadelis, S. (2012). "Public Procurement Design: Lessons from the Private Sector." *International Journal of Industrial Organization* 30(3).**
3. **Macaulay, S. (1963). "Non-Contractual Relations in Business: A Preliminary Study." *American Sociological Review* 28(1).** — *Seminal.* How agreements are actually governed.
4. **Kelman, S. (1990). *Procurement and Public Management: The Fear of Discretion and the Quality of Government Performance*. AEI Press.** — *Seminal.* The cost of rule-bound purchasing, argued from government computer procurement.
5. **Lessig, L. (1999). *Code and Other Laws of Cyberspace*. Basic Books.** — *Seminal.* Architecture as a mode of regulation.
6. **Regulation (EU) 2016/679 (GDPR); Regulation (EU) 2024/1689 (AI Act); Regulation (EU) 2024/2847 (Cyber Resilience Act).** — *Primary sources; recent.*

Also: **Hart, H. L. A. (1961). *The Concept of Law*** (open texture; cited in §17). **Mohun, J. & Roberts, A. (2020). *Cracking the Code: Rulemaking for Humans and Machines*. OECD Working Papers on Public Governance 42.** **Merigoux et al. (2021)**, cited in §17.

### Self-check questions

1. State the objectives of public procurement law. For each, say what it implies for how a tender for custom software must be structured, and where that conflicts with Part III.
2. Explain Bajari and Tadelis's result in two sentences. Classify your last three purchases as simple or complex in their sense, and compare with the contract type used.
3. Why can a private buyer rely on relationship and reputation where a public buyer cannot? Which lawful instruments partly substitute?
4. Draft the review clause for a development contract: what may change, within what limits, decided by whom. Why must it be precise?
5. A statute gives an official discretion "in justified cases". List the design options for a system that processes these cases, and what each does to the citizen's legal position.
6. For one system, list every store in which a given person's data resides, including logs, backups, test environments, and derived data. Which of them could you delete from today?

---

## 23. Software and society

### The constraint

Software that administers social processes is not a neutral instrument. Five properties distinguish it from the clerks and paper it replaces.

- **It encodes one interpretation** of rules that were written to be interpreted (§17, §22).
- **It applies that interpretation uniformly and at scale.** An error is a systematic error, affecting everyone in the same situation.
- **It removes discretion** unless discretion is designed in.
- **It changes the practice it models.** Officials, citizens, and other institutions adapt to it, so the world it was specified against ceases to exist (§15, E-type).
- **Those affected are not those who specify, pay, or build.** Citizens meet the system as a fact.

Over time such systems become infrastructure: taken for granted, invisible until they fail, and very hard to change.

### What goes wrong

Four well-documented cases. Figures are from public inquiries and court findings **[verify exact numbers before quoting]**.

- **United Kingdom, Post Office Horizon (1999–2015).** An accounting system used in post office branches contained defects that produced false shortfalls. The Post Office prosecuted several hundred subpostmasters for theft and false accounting on the system's evidence; more were made to repay or lost their livelihoods. English law presumed computer evidence reliable unless shown otherwise. The organization and its supplier knew of defects and of remote access to branch accounts and maintained that the system was robust. Convictions were eventually quashed, by the courts and then by legislation in 2024, and a public inquiry reported from 2025.
- **Netherlands, childcare benefits (roughly 2005–2019).** The tax administration pursued suspected fraud in childcare allowances with an all-or-nothing recovery rule and a risk-selection model that used, among other things, nationality. Tens of thousands of families were wrongly required to repay large sums. A parliamentary inquiry found violations of fundamental principles of the rule of law. The government resigned in January 2021.
- **Australia, "Robodebt" (2015–2019).** The welfare agency matched annual income from tax records against fortnightly benefit declarations by dividing the annual figure evenly across the year, and raised debts automatically where the two differed, leaving recipients to disprove them. The averaging had no basis in the governing law. Several hundred thousand debts were raised unlawfully and later refunded. A Royal Commission reported in 2023.
- **United States, Michigan unemployment insurance (2013–2015).** An automated system issued tens of thousands of fraud determinations without human review. A later review of a large sample found the great majority to be wrong.

The common pattern is not sophisticated technology. Horizon was an accounting system with ordinary bugs. Robodebt was a division. The pattern is institutional:

1. A rule or assumption was encoded that was wrong in law or in fact.
2. It was applied automatically to very many people.
3. The burden of proof moved to the individual.
4. The system's output was treated as authoritative by the organization and often by courts.
5. Internal knowledge of the problem did not travel upward or was not acted on (§19, §20).
6. Correction came from outside, years later: courts, journalists, parliament.

**Other recurring harms.**
- **Exclusion.** Services reachable only with particular devices, credentials, or skills. Inaccessible interfaces.
- **Categories that do not fit.** Forms that cannot record a person's actual situation (§10), so that the person must misstate it or cannot proceed.
- **Function creep.** Data collected for one purpose is used for another because it is there and linkable.
- **Automation bias.** An official asked to review automated proposals approves them.
- **Loss of understanding in the organization.** When the system applies the rules, staff stop knowing them. "The system does not allow it" replaces reasons (§13, Bainbridge).
- **Fluent wrong answers with institutional authority.** A public body's conversational assistant states something false about a person's rights or deadlines.

### What you must understand

**From street-level to system-level bureaucracy.** Lipsky (1980) described *street-level bureaucrats*: the caseworkers, police officers, and teachers who meet citizens directly. Because rules never fit cases exactly and resources are short, they exercise wide discretion, and their accumulated decisions are in effect the policy.

Bovens & Zouridis (2002) traced what information technology did to this.
- In a **screen-level bureaucracy**, the official works through a system that structures and limits each decision.
- In a **system-level bureaucracy**, the system makes the routine decisions. Officials deal with exceptions and complaints.

Discretion has not vanished. It has moved to the people who translate legislation into decision rules, data models, and code: system designers, analysts, and legal-policy staff. They make the choices that caseworkers used to make, once, for all cases, in advance, and outside public view. Bovens and Zouridis concluded that this translation needs its own safeguards: published decision rules, an explicit and reviewable link from each rule to its legal source, and supervision of the translation process. For anyone who builds public systems, this is a description of their own position.

**Code as regulation, with its particular character.** From Lessig (§22): a rule in code is enforced in advance and without exception. Compared with a legal rule it lacks:
- an official who can consider the circumstances;
- the possibility of acting first and justifying afterwards;
- visibility, since the rule is in an implementation few can read;
- an obvious procedure for challenge.

These absences are what make automated administration efficient and consistent. They are also the safety valves that law provides. A system has to rebuild them deliberately if they are to exist.

**Values in technical choices.** Winner (1980) argued that technical arrangements can embody political relations, by design or by effect. His best-known illustration, low bridges said to have been built to keep buses from a public beach, is historically disputed; the general point does not rest on it. Friedman & Nissenbaum (1996) gave a taxonomy of bias in computer systems that remains useful:

| Kind | Source | Example |
|---|---|---|
| Pre-existing | Social attitudes and institutions carried into the system | A risk model trained on past enforcement that concentrated on certain groups |
| Technical | Constraints of representation and algorithm | One address field; alphabetical ordering; a matching rule that fails for certain name forms |
| Emergent | Use in a context that differs from the one designed for | A system built for employees applied to the self-employed |

**Legibility again.** Scott's argument (§20) applies with full force to registers, identifiers, and classifications, which are the instruments by which a state sees its population. Legibility is what makes services, entitlements, and equal treatment possible at scale. It is also what makes control possible. Two conclusions follow. The same infrastructure serves both, so the safeguards have to be institutional: legal limits on use, visibility to citizens of who accessed their data, and independent oversight. And every classification omits something that matters to somebody, so the edges of the scheme need a human route.

**Classification has consequences.** Bowker & Star (1999) studied classification systems, from disease codes to racial categories under apartheid. Each category makes some things visible and others invisible, advantages some people and burdens others, and becomes harder to see as a choice the longer it is in use. A data model is such a system (§10).

**Infrastructure.** Star & Ruhleder (1996) characterized infrastructure by its relations to practice: it is embedded in other structures, transparent in use, learned as part of belonging to a community, shaped by conventions, built on an installed base, and visible mainly upon breakdown. Two consequences for long-lived public systems:
- **Infrastructure is grown from what exists, not designed from nothing.** Successful shared layers have typically evolved in steps from working parts. Comprehensive redesigns from a blank page have a poor record.
- **Early choices persist.** Identifiers, formats, and interfaces chosen for local reasons become fixed points that later systems must accommodate (§12, §15). Economists call this path dependence (Arthur 1989; David 1985, though his keyboard example is disputed).

**Reflexivity.** People respond to the systems that measure and decide about them. They learn what the system rewards and supply it (Goodhart, §20, at the scale of a society). MacKenzie (2006) showed that financial models altered the markets they described. A system that models social behaviour is also an intervention in it. This is the societal form of Lehman's E-type (§15) and one more reason requirements do not hold still.

**Systematic and random error.** Human decision-makers are *noisy*: different officials decide like cases differently, and the same official decides differently on different days (Kahneman, Sibony & Sunstein 2021). They are also biased. An automated rule removes the noise and makes whatever bias it has uniform. Whether that is an improvement depends on the rule. Three points for design:
- At scale, small error rates are many people. One percent of 400,000 decisions is 4,000 wrong decisions.
- Errors are not symmetric. Wrongly accusing a person of fraud and wrongly missing a fraud have different costs and fall on different parties. Someone must choose the balance.
- Correlated errors hit the same group repeatedly. A caseworker's mistakes are scattered; a rule's mistakes follow its logic.

**Fairness cannot be fully specified.** For risk scores, several intuitive fairness criteria, such as equal accuracy of scores across groups and equal error rates across groups, cannot all hold at once when the groups' underlying rates differ (Kleinberg, Mullainathan & Raghavan 2017; Chouldechova 2017). Which criterion to satisfy is a normative decision. It cannot be delegated to the model or to the engineers, and it should be made by someone with the standing to make it.

**Technological due process.** Citron (2008) examined what automation does to procedural protections. Automated systems blur the line between making a rule and applying it: a policy change arrives as a code change, without the notice and consultation that rule-making requires. They also weaken individual adjudication: the person receives an outcome without reasons, and the reviewing official defers to the system. Her proposed safeguards translate directly into requirements:

| Safeguard | Requirement on the system |
|---|---|
| Notice and reasons | Every decision carries an explanation in terms of the person's data and the rule applied |
| Audit trail | Inputs, rule version, and outcome are recorded for each decision (§10) |
| Meaningful human review | A reviewer with the information, time, and authority to decide otherwise, and no penalty for doing so |
| Testing against the law | Decision rules are tested against legally worked examples and published |
| Monitoring | Outcomes are tracked by group and over time to detect systematic error |
| Correction at scale | When a rule is found wrong, all affected decisions can be identified and redone |

The last row follows from the first constraint of this set. If errors are systematic, correction must be too, and that needs the audit trail.

**Administrative burden.** Herd & Moynihan (2018) analyse the costs that people bear in dealing with the state: *learning* what they are entitled to and how to get it, *complying* with forms and evidence requirements, and the *psychological* cost of the process. System design shifts these between state and citizen. Pre-filled data and the principle of asking only once move burden to the state and raise take-up. Verification steps and mandatory digital channels move it to the citizen, and it falls hardest on those with the least capacity to bear it. Burdens can also be created deliberately as policy by other means.

**Transparency and accountability instruments.**
- Public registers of algorithms used by public bodies (several cities and states maintain them).
- Impact assessments before deployment (Canada's directive on automated decision-making; the fundamental-rights impact assessment for certain deployers under the EU AI Act).
- Publication of decision rules and, where possible, source code.
- Showing citizens who has accessed their data.
- Independent audit.

Each makes the translation described by Bovens and Zouridis visible to someone outside the team that performed it.

**Generative AI in the service of the state.** *Tentative.* A conversational assistant on a public body's site speaks with that body's authority in the eyes of a citizen. In a 2024 Canadian tribunal decision an airline was held responsible for incorrect information given by its website chatbot; the argument that the chatbot was a separate source was rejected. For public bodies, doctrines protecting reliance on official statements may apply with more force. The safer designs give the assistant a navigational role, ground every statement in cited official text, keep facts about the individual's case in structured data shown directly (§14, Example 14.3), and make the route to a human obvious.

**Professional responsibility and its limits.** Codes of ethics (for example the ACM's, revised in 2018) place duties on individual engineers. The cases above show the limit of relying on that: in each, individuals knew or suspected and the organization continued. The effective protections are structural: review independent of the delivering unit, channels through which doubts reach people who can act, legal exposure for the organization, and external scrutiny. Individual conscience is necessary and has not been sufficient.

### Trade-offs and alternatives

| Choice | Option A (cost) | Option B (cost) |
|---|---|---|
| Decision mode | Fully automated (fast, cheap, consistent; systematic error; no discretion) | Automated proposal with human decision (discretion kept; automation bias; cost), or automation for clear cases only |
| Rule design | Uniform rule (equal formal treatment; hard cases treated wrongly) | Rule with exceptions route (individual justice; slower; inconsistency) |
| Error balance | Minimize missed fraud (many false accusations) | Minimize false accusations (more loss); the choice belongs to an accountable body |
| Transparency | Publish rules and models (accountability; easier gaming) | Keep them internal (harder to game; unaccountable) |
| Data sharing | Link across registers (convenience, once-only; surveillance potential) | Separate by purpose (privacy; repeated burden on citizens) |
| Channels | Digital by default (efficient; excludes some) | Maintain assisted and offline channels (inclusive; costly) |
| Change | Grow infrastructure incrementally (continuity; carries old choices forward) | Redesign comprehensively (clean; high failure risk) |

### Contested points

- **How far "code is law" goes.** Lessig's thesis is sometimes read as technological determinism. Critics point out that code is itself shaped by law, markets, and norms, and can be changed. The modest reading used here, that architecture regulates and does so in a particular manner, is widely accepted.
- **Winner's bridges.** The specific historical claim has been challenged (Joerges 1999). The broader claim that designs have political effects stands on other evidence.
- **Automation versus human judgment.** One literature documents harm from automated administration (Eubanks 2018). Another documents inconsistency and bias in human decision-makers (Kahneman et al. 2021). Both are right. The question for any given decision is which errors are more tolerable and which are more correctable.
- **Fairness criteria.** The impossibility results are mathematics. Which criterion should govern which decision is disputed among researchers, lawyers, and affected groups.
- **Electronic voting over the internet.** Proponents cite accessibility, verifiability measures, and many years of operation without a demonstrated compromise. Critics in the security research community argue that the threat model for national elections cannot be met with current client devices and procedures. The disagreement is about acceptable risk and burden of proof, and remains open.
- **Explainability.** Whether a right to explanation exists in general data-protection law, and what would satisfy it, is debated. For administrative decisions the duty to give reasons is older and firmer.
- **Solutionism and its critics.** Some hold that digital government systematically over-promises (Morozov 2013). Others point to large, measured reductions in burden and cost. Neither general position decides a particular case.

### Examples

**Example 23.1 — Robodebt in the terms of §17.**

- **R** (requirement): recover benefit overpayments from people who under-declared income.
- **S** (specification): where annual income from tax records, divided by 26, exceeds declared fortnightly income for a benefit period, raise a debt and notify the person.
- **W** (domain assumption): a person's income is spread evenly across the year.

S was implemented correctly. W is false for precisely the people who claim income support, since they do so because their income is irregular. R was therefore not achieved and something else was: debts raised against people who owed nothing. No test of the software against S could have revealed it. Writing W down and showing it to anyone who knew the client group would have.

**Example 23.2 — A decision record that supports due process (SQL).**

```sql
CREATE TABLE decision (
    decision_id     uuid PRIMARY KEY,
    case_id         uuid        NOT NULL,
    decided_at      timestamptz NOT NULL,
    outcome         text        NOT NULL,
    ruleset_version text        NOT NULL,        -- which encoding of the law
    legal_basis     text[]      NOT NULL,        -- provisions applied
    inputs          jsonb       NOT NULL,        -- the facts as known at decided_at
    explanation     text        NOT NULL,        -- reasons, in the person's terms
    decided_by      text        NOT NULL,        -- 'automated' or an official's identifier
    reviewed_by     text,                        -- set when a human reviewed
    supersedes      uuid REFERENCES decision     -- corrections are new decisions
);
```

With this table three questions can be answered that the cases above could not answer for years: why was this decided; who else was decided under the same rule version; and what would the outcome be under the corrected rule. The table is cheap. Its absence is what turns a defect into a scandal.

**Example 23.3 — Designing the exception route.** A report arrives two minutes after the deadline. The service had been unavailable for twenty minutes before midnight.

| Design | Outcome |
|---|---|
| Automated late fee, no route | Uniform, fast, and wrong for this person; they must find out how to complain |
| Automated late fee; official may waive on request | Correct if the person asks; burden is on them |
| System checks its own availability log and does not treat submissions as late when an outage overlapped the deadline | Correct without anyone asking, for a foreseeable class |
| Clear cases automated; anything within a margin, or coinciding with an incident, goes to an official with the facts assembled | Discretion placed where the rule is open |

The third and fourth cost a little more to build. They encode something the legislator would certainly have wanted and did not write. Deciding that requires authority (§17, §22), which is the reason the question should be put to those who have it, during design.

### Key literature

1. **Lipsky, M. (1980). *Street-Level Bureaucracy: Dilemmas of the Individual in Public Services*. Russell Sage Foundation.** — *Seminal.* Discretion at the point of contact as the real content of policy.
2. **Bovens, M. & Zouridis, S. (2002). "From Street-Level to System-Level Bureaucracies: How Information and Communication Technology Is Transforming Administrative Discretion and Constitutional Control." *Public Administration Review* 62(2).** — *Seminal.* Where discretion goes when systems decide. The paper most directly about the reader's own role.
3. **Citron, D. K. (2008). "Technological Due Process." *Washington University Law Review* 85(6).** — *Seminal.* Procedural safeguards for automated decisions.
4. **Bowker, G. C. & Star, S. L. (1999). *Sorting Things Out: Classification and Its Consequences*. MIT Press.** — *Seminal.* Classification systems as infrastructure with moral weight. With **Star, S. L. & Ruhleder, K. (1996). "Steps toward an Ecology of Infrastructure." *Information Systems Research* 7(1).**
5. **Friedman, B. & Nissenbaum, H. (1996). "Bias in Computer Systems." *ACM Transactions on Information Systems* 14(3).** — *Seminal.* Pre-existing, technical, and emergent bias.
6. **Royal Commission into the Robodebt Scheme (2023). *Report*. Commonwealth of Australia.** — *Recent; primary source.* The most thorough public account of how an unlawful automated scheme was built, defended, and ended.

Also: **Winner, L. (1980). "Do Artifacts Have Politics?" *Daedalus* 109(1).** **Herd, P. & Moynihan, D. P. (2018). *Administrative Burden: Policymaking by Other Means*. Russell Sage Foundation.** **Kleinberg, J., Mullainathan, S. & Raghavan, M. (2017). "Inherent Trade-Offs in the Fair Determination of Risk Scores." ITCS '17.** **Kahneman, D., Sibony, O. & Sunstein, C. R. (2021). *Noise*. Little, Brown.** **Eubanks, V. (2018). *Automating Inequality*. St. Martin's Press.** **Lessig (1999)** and **Scott (1998)**, cited earlier.

### Self-check questions

1. Using Bovens and Zouridis, identify who exercises discretion in a system you work on. Is that visible to anyone outside the team, and what would make it so?
2. Take the six-step pattern from the four cases. For a system you know, say at which step the pattern would be interrupted, and by what.
3. A rule in your system is discovered to have been wrong for eighteen months. What do you need in order to find and correct every affected decision? Do you have it?
4. A fraud-detection model has a 2% false-positive rate on 300,000 claims. Who should decide whether that is acceptable, what should happen to a flagged claim, and what should the person be told?
5. Classify one bias you have seen in a system as pre-existing, technical, or emergent. What would have detected it before deployment?
6. Your organization plans a conversational assistant for citizens. State the role you would give it, what it may never be the source of, and how a citizen reaches a person.

---

## Closing Part IV: the chains run both ways

The Introduction followed a chain upward from a physical constant to a tender clause. With all four parts in place, the opposite direction is equally instructive.

**A chain downward.**

1. Procurement law requires equal treatment and decisions that can be reviewed (§22).
2. So the buyer writes a fixed specification and awards mainly on price.
3. The specification cannot carry the meaning, and the buyer cannot observe quality (§17, §21).
4. The work is divided into lots; the lots become organizational boundaries (§19).
5. Those boundaries cut through reciprocally dependent work, so understanding is fragmented, and it is lost again at each re-tender (§18).
6. Module boundaries follow the contract boundaries, not the domain (§11).
7. An invariant that the business needs now spans two suppliers' components and becomes a distributed consistency problem (§5, §6).
8. It is handled with asynchronous messaging and a reconciliation job (§4).
9. The reconciliation job runs nightly, and a citizen sees inconsistent data for a day, which a caseworker cannot explain (§23).

A reader who meets only step 8 sees a technical design choice. Its cause is in step 1.

**What Part IV adds to Part III.** Part III closed by observing that the conduit model of specification persists because institutions need commitments that are written, fixed in advance, and checkable by outsiders. Part IV has shown what those needs are and where they come from:

| Institutional need | Source | Met today by | Can be met instead by |
|---|---|---|---|
| Divisible work | Coordination limits (§19) | Functional hand-offs, lots | Modular architecture with teams aligned to modules |
| Visible progress | Agency and legibility (§20) | Document milestones, status colours | Working increments, retired unknowns, decision logs |
| Predictable cost | Budgeting (§21) | Fixed scope and price | Fixed capacity and ceilings with ranges and exit points |
| Fair award | Procurement principles (§22) | Detailed specification, price criterion | Negotiated procedures, practical assessment, review clauses |
| Accountability to citizens | Rule of law (§23) | Conformity to specification | Decision records, reasons, human review, published rules |

The right-hand column does not deny the needs. It meets them without depending on a specification that says everything in advance. Each entry asks for more capability on the client's side than the middle column does, which is the recurring finding of this part: **an organization cannot buy what it cannot understand** (§18, §21).

---

> **End of installment 4.** This installment covers Part IV (sets 19–23). With it, the four layers announced in the Introduction are complete. Still unwritten: **Part V** (the cross-cutting lenses of time, cost, and failure) and the **closing sections**. Part I also refers several times to "closing chains", which are presumably meant to appear there.
