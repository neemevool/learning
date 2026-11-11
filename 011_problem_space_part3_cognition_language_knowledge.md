# 011 — The Problem Space of Software Engineering

### Installment 3 — Part III: Human cognition, language, and knowledge (sets 16–18)

> **Installment status.** This file contains Part III (sets 16–18), including subclasses 16a–16e and the note on the current moment. It continues installments 1 and 2. The original brief was lost; the structure is reconstructed from the Introduction of installment 1. As promised there, the recent literature in this part was checked on the web in November 2026. Verified items: Fedorenko, Piantadosi & Gibson (2024); Ivanova et al. (2020); Nedergaard & Lupyan (2024) and the 2025 commentary disputing it; Yeshurun et al. (2017); Méndez Fernández et al. (2017); Becker et al. (METR, 2025). Older literature rests on background knowledge. Unverified details are marked **[verify]**.

---

# Part III: Human cognition, language, and knowledge

## The standpoint this part examines

Part III was written against a stated position, which I summarize in five theses. The position comes from the commissioning discussion for this article. I agree with its direction and disagree with parts of its wording, and since the disagreement affects what follows, I state it first.

| # | Thesis as stated | Assessment | Where |
|---|---|---|---|
| T1 | The hope that a "clear" specification resolves a software project has vanished. | **Well supported** in its strong form: no specification, however careful, can be complete, unambiguous, and stable in advance for a system embedded in human practice. **Overstated** if read as "specifications do not help". They help as instruments for a different job. | §17, closing section |
| T2 | It has recently been admitted that human thought cannot be formalized and translated into software. | **Imprecise.** What is supported: (a) no formal text determines its own application; (b) much expert knowledge is tacit; (c) the step from the informal world to a formal description cannot itself be formal. What is not supported: that thought as such resists formalization. Mathematics, type systems, and encoded legislation formalize fragments successfully. The limit lies at the boundary between formal and informal, not everywhere. | §17, §18 |
| T3 | Language is not the mechanism that drives thought. Language is not needed for thinking. | **Well supported for the adult brain, with a stated scope.** The neuroscience is strong that the language network is not engaged in most reasoning and that reasoning survives its loss. Residual debate concerns development, language as a learned scaffold, and inner speech. | §16b |
| T4 | A text causes very variable inference in different readers. | **Supported, with a qualifier that changes the practical conclusion.** Variation is not noise. It is a function of the reader's prior knowledge and expectations. Where priors are shared, interpretations and even neural responses converge. So the variation is manageable, though by building shared context and not by perfecting text. | §16c, §17 |
| T5 | All these limits were denied until recent times. | **Not accurate.** The core arguments are 40 to 70 years old. What is recent is converging experimental evidence and a practical test. | Timeline below |

**A timeline of recognition.** The limits were stated clearly, by well-known people, long ago:

| Year | Source | Claim |
|---|---|---|
| 1932 | Bartlett, *Remembering* | Comprehension and recall are reconstruction from the reader's schemas |
| 1945 | Hayek | Knowledge of particular circumstances is dispersed and cannot be centralized |
| 1949 | Ryle | Knowing how is not reducible to knowing that |
| 1953 | Wittgenstein, *Philosophical Investigations* | A rule does not contain its own application; meaning rests on shared practice |
| 1966 | Polanyi, *The Tacit Dimension* | We know more than we can state |
| 1970 | Royce | The paper usually cited as the origin of "waterfall" calls the single-pass version risky and inviting failure |
| 1972 | Dreyfus, *What Computers Can't Do* | Expertise does not consist of rules; the background cannot be made explicit |
| 1973 | Rittel & Webber | Wicked problems have no definitive formulation |
| 1979 | Reddy | The "conduit" picture of communication is a misleading folk theory |
| 1980 | Lehman | For E-type systems the specification cannot be complete in advance (§15) |
| 1985 | Naur | A program is a theory held by its programmers; it cannot be written down |
| 1986 | Brooks; Parnas & Clements | The hard part is deciding what to build; the rational design process is an idealization one can only fake |
| 1987 | Suchman | Plans are resources for situated action, not determinants of it |
| 1995 | Jackson | The requirement is about the world; the step from world to formal specification is not formal |

So why does the belief feel recently overturned? Three reasons, and the third is the interesting one.

1. **The evidence changed kind.** Until about 2010 the case rested on philosophical argument, ethnography, and behavioural experiments. Since then, neuroimaging and lesion studies have added direct evidence about language and thought (§16b) and about how interpretation varies between brains (§16c).
2. **Large language models supplied an existence proof and a test.** They show fluent language without the rest of cognition (§16b). And by making implementation cheap, they isolate what remains hard, which turns out to be intent and understanding (§16, note on the current moment).
3. **Institutions never acted on what the minority tradition knew.** Procurement law, contract practice, project governance, and audit all require written, verifiable commitments made in advance (§20–§22). They need the conduit model to be true. The belief was not held because nobody had refuted it. It was held because the institutions around software are built on it. That is why Part III cannot be read without Part IV.

**A note on "the latest philosophers".** Recent philosophy of language and mind mostly elaborates the mid-century insights; it did not discover them. The work most relevant here: Brandom's inferentialism (meaning as a role in reasoning), the contextualist literature on how far truth conditions depend on occasion (Recanati, Travis), the "4E" movement on embodied and enacted cognition, predictive-processing accounts of perception and comprehension (Andy Clark), and accounts of language as a tool for coordinating imagination and action (Dor 2015; Christiansen & Chater 2022). I use them below where they sharpen a point.

**Epistemic warning.** Applying neuroscience to requirements engineering is an inference, and it is mine. The studies in §16b and §16c were not conducted on analysts or specifications. I mark such steps as **tentative** where I take them.

---

## 16. Cognition

### The constraint

Every part of a software system must at some point pass through an individual human mind: to be conceived, understood, judged, or changed. That mind has specific properties.

- It can hold very little at once (16a).
- Its thinking is mostly not in language, so putting thought into words is a lossy translation (16b).
- It understands text by constructing a model from its own prior knowledge, so different minds construct different models from the same words (16c).
- Its judgment under uncertainty is systematically biased, and its confidence is poorly calibrated wherever feedback is slow (16d).
- What it understands is a capacity that it has, not a content that can be copied to another mind (16e).

These are properties of the species, with individual variation. Tools, notations, and methods can work with them or against them. They cannot remove them.

---

### 16a. Bounded working memory and attention

**The constraint.** Working memory holds about four chunks of novel information at a time (Cowan 2001, revising Miller's "seven plus or minus two" of 1956). A *chunk* is whatever the person's long-term memory can treat as one unit. Experts hold more, not because their working memory is larger, but because their chunks are larger (Chase & Simon 1973: chess masters recall real game positions far better than novices and random positions no better). Attention is serial for demanding tasks, and switching between tasks has a cost.

**What goes wrong.**
- A change that requires seven facts from five files to be held at once will be made with one of them forgotten.
- A function with many interacting flags exceeds what can be simulated mentally. The developer tests two paths and assumes the rest.
- A reviewer faced with a thousand-line change reads the first part carefully and skims the remainder.
- An interrupted developer resumes with part of the mental state gone. The missing part is usually an unstated constraint.
- Novices are overloaded by code that experts find simple, because the same code is many chunks for one reader and few for the other. Experts routinely misjudge this (16e).

**What you must understand.**
- **Cognitive load theory** (Sweller 1988) separates load inherent in the material (*intrinsic*) from load caused by its presentation (*extraneous*). Design, naming, and layout can reduce the second. Only learning, which builds chunks, reduces the first.
- **Program comprehension** has been studied since the 1980s. Readers combine top-down hypotheses, triggered by recognizable cues ("beacons") and familiar patterns ("plans"), with bottom-up simulation when cues fail (Soloway & Ehrlich 1984; Letovsky 1987; von Mayrhauser & Vans 1995). Code that follows conventions is read top-down and cheaply. Code that violates them forces simulation, which is where working memory runs out.
- **Neuroimaging agrees.** Reading code activates the brain's domain-general "multiple-demand" network, the same system used for any hard reasoning, and engages the language network weakly or not at all (Ivanova et al. 2020; Liu et al. 2020; earlier Siegmund et al. 2014). Reading code is hard thinking, not reading in the linguistic sense (see 16b).
- **Interruption.** Resuming a programming task requires rebuilding context, and programmers use cues in the environment to do it (Parnin & Rugaber 2011). The often-quoted figure of 23 minutes to recover from an interruption comes from office-work observation and should not be cited as a programming constant **[verify source: Mark et al.]**.
- **The design consequence.** Locality, small interfaces, and deep modules (§11) are ways of keeping the number of things needed at once within working-memory limits. Type systems (§9) and tests move facts from the head to the machine. Limits on work in progress and on review size follow from the same arithmetic.

---

### 16b. Thought is not language

**The constraint.** Thinking and language are separate systems in the adult human brain. Language is a code for communicating thoughts, not the medium in which they occur. Converting a thought into words is therefore a translation into a narrower format, performed for a listener, and something is lost and something is added each time.

**The evidence.** Fedorenko, Piantadosi & Gibson (2024) reviewed two decades of work in a *Nature* Perspective. The main lines:

- **Dissociation by lesion.** People with severe aphasia, who can neither produce nor understand sentences, can still do arithmetic, solve logic problems, play chess, reason about causes and about other people's beliefs, and plan.
- **Dissociation in the other direction.** Some people with intact language have severely impaired reasoning.
- **Dissociation by imaging.** The language network can be located reliably in an individual. It responds strongly during comprehension and production of language. It stays largely silent during mathematics, logic, music, spatial reasoning, social reasoning, and the comprehension of computer code. Those tasks engage other networks.
- **Design evidence.** Across languages, the properties of words and grammars look optimized for efficient, robust communication: frequent words are short, dependent words stay close together, and redundancy protects against noise. These properties would serve no purpose in a private medium of thought.

The authors conclude that language is primarily a tool for communication, and that it reflects the sophistication of human thought without producing it.

**Scope and counter-evidence.** The conclusion is strong for mature brains and specific to the question "is language the substrate of thought". It does not say language has no effect on thinking.

- **Development.** Children who are deprived of language input, for example deaf children without early sign language, show delays in reasoning about other minds. Exact number concepts beyond about four seem to depend on having number words (studies of the Pirahã and of Nicaraguan homesigners). Language appears to be needed to *acquire* some concepts, even if it is not needed to *use* them afterwards.
- **Language as scaffold.** A long tradition (Vygotsky; Andy Clark 1998; Lupyan's work on labels) holds that words work as tools: they stabilize categories, hold intermediate results, and let us think about our own thoughts. Writing a design down often changes the design. This is compatible with the dissociation: a tool can improve an activity without being its substrate.
- **Inner speech varies.** Many people report a near-constant inner voice and some report almost none. Nedergaard & Lupyan (2024) found that people reporting little inner speech performed worse on verbal working-memory and rhyme-judgment tasks and no differently on task switching, and proposed the name *anendophasia*. A 2025 commentary in the same journal argues that the data do not show a complete absence of inner speech in anyone. What is not disputed is the large variation in how verbal people's conscious thinking feels. Related variation exists for mental imagery (aphantasia, Zeman et al. 2015).
- **Status.** The 2024 paper is a Perspective, which is a reasoned position and not a meta-analysis. It attracted published replies, including from researchers who defend a larger cognitive role for language. I rate the core dissociation **well supported** and the stronger slogan "language plays no role in thought" **not supported**.

**The idea is old; the evidence is new.** Fodor (1975) argued for a "language of thought" that is language-like in structure and distinct from any spoken language. Pinker (1994) popularized the same separation. Mathematicians' reports of wordless thinking were collected by Hadamard in 1945. What changed is that the claim moved from argument to measurement.

**What goes wrong when this is ignored.**
- **Fluency is taken for understanding.** The stakeholder who describes the process most articulately is assumed to understand it best. The quiet expert who "cannot explain it" is assumed not to know. Both inferences are unreliable, because verbal skill and domain reasoning are different capacities.
- **A verbal report is taken for a readout.** When a domain expert describes how they decide, they are not reading out an internal rule. They are composing a description, on demand, of a largely non-verbal skill. Nisbett & Wilson (1977) showed that people's explanations of their own decisions are often plausible reconstructions that do not match the actual causes. Johansson et al. (2005) showed people confidently explaining choices they had not made. Requirements interviews collect such compositions.
- **The specification is taken for the thought.** The analyst's document is a second translation, into the analyst's words, of the expert's first translation.
- **"Programming language" is taken literally.** Code comprehension does not use the language system (16a). Aptitude for natural languages and aptitude for programming are different things, and prose-like syntax does not make programs easier to reason about.

**The converse dissociation: language models.** Large language models produce fluent, grammatical, contextually appropriate language. Mahowald, Ivanova and colleagues (2024) distinguish *formal* linguistic competence, which the models have, from *functional* competence, which includes reasoning, world knowledge, and modelling of situations and intentions, and which the models have unevenly. In humans the two are served by different brain systems. The models show from the other side that mastery of language does not by itself deliver thought. This matters for the note at the end of §16.

---

### 16c. Comprehension is construction

**The constraint.** A reader does not extract a meaning from a text. A reader builds a model of the situation the text is about, using the words as cues and their own knowledge as material. Two readers with different knowledge build different models from the same words. Neither notices, because each model feels like "what the text says".

**The evidence.**
- **Reconstruction.** Bartlett (1932) had English readers retell a Native American folk tale. They changed unfamiliar elements into familiar ones and remembered their own version as the original.
- **Context determines comprehension.** Bransford & Johnson (1972) gave readers a passage that is nearly meaningless without a title (it describes sorting things into groups, using facilities, and repeating the procedure). Told beforehand that it is about washing clothes, readers understood and recalled it. Told afterwards, they did not benefit. The words were identical.
- **Levels of representation.** Kintsch (1988, 1998) distinguishes the surface form, the *textbase* (the propositions stated), and the *situation model* (the reader's model of what is described, built with inferences from prior knowledge). Recall of wording fades in seconds. What persists and drives later action is the situation model.
- **Good-enough processing.** Readers do not compute full, accurate interpretations. They build representations that are just adequate for their apparent purpose (Ferreira, Bailey & Ferraro 2002). Asked how many animals of each kind Moses took on the ark, most people answer "two" (Erickson & Mattson 1981). After reading a sentence that first invites one parse and then requires another, readers often keep the first, wrong interpretation alongside the correct one (Christianson et al. 2001).
- **Prediction.** Comprehension is largely predictive: the brain anticipates upcoming input and processes mainly the deviations (predictive-processing accounts; A. Clark 2013, 2016). A reader who expects a specification to say something tends to see it there. Authors proofreading their own text are the extreme case.
- **Interpretation in the brain.** Yeshurun et al. (2017) had two groups listen to the same story after different one-paragraph introductions. In one the wife is unfaithful; in the other the husband is paranoid. Neural responses in higher-order areas were similar within each group and different between groups, and the size of the neural difference tracked the size of the difference in interpretation moment by moment. Stephens, Silbert & Hasson (2010) had earlier shown that the degree to which a listener's brain activity follows the speaker's predicts how well the listener understood.

**The qualifier.** The same line of research shows convergence. People who share context show closely aligned responses to the same narrative. Variation between readers is therefore not randomness in the channel. It is the visible part of differences in prior knowledge and expectation. This is thesis T4 with its correction: **text does produce variable inference, and the variation is explained by, and can be reduced through, shared context.**

**Illusions that hide the variation.**
- **Illusion of explanatory depth** (Rozenblit & Keil 2002). People believe they understand how ordinary mechanisms work until they are asked to explain them step by step. A reader of a specification feels they understand it. The feeling is not evidence.
- **Curse of knowledge** (Camerer, Loewenstein & Weber 1989). Once you know something, you cannot simulate not knowing it. In Newton's tapping study (1990), people tapped the rhythm of a well-known song and predicted that listeners would name it about half the time. Listeners succeeded in about one case in forty. The writer of a specification hears the tune.
- **Illusion of transparency.** Speakers overestimate how clearly their intent comes across.

**What goes wrong.**
- A specification is reviewed and approved by five people who each read it as confirming their own model. The models differ. The differences appear at acceptance testing.
- "Is this clear?" is answered "yes" by everyone, truthfully.
- A developer implements exactly what the text says under a reading the author never considered and cannot see even when it is pointed out.
- A translated or summarized requirement is a new construction by the translator.

**What you must understand.**
- A specification is a **prompt for model construction**, not a container of meaning.
- **Agreement on wording is not agreement on meaning.** The only test of whether two people built the same model is to compare what each derives from it: examples, edge cases, predictions, test cases, a prototype.
- **Ask for consequences, not confirmation.** "What happens if the report arrives two minutes after midnight?" reveals the model. "Do you agree with section 4.2?" does not.
- **Shared context is built by shared activity**, which is slow (§17 on grounding, §18).

---

### 16d. Judgment under uncertainty

**The constraint.** People cannot optimize; they *satisfice*, choosing the first option that seems good enough given limited time and information (Simon 1955). Their judgments under uncertainty rely on heuristics that are fast, usually adequate, and wrong in systematic ways (Tversky & Kahneman 1974). Their confidence tracks the coherence of the story they have built, not the quality of the evidence.

**What goes wrong.**
- **The planning fallacy.** People predict from the specifics of the case in front of them (the "inside view") and ignore how similar cases went. Students predicting their own thesis completion were badly optimistic even when asked for worst-case estimates (Buehler, Griffin & Ross 1994).
- **Anchoring.** A number mentioned first pulls later estimates toward it. In a software-estimation experiment, an offhand remark about expected effort shifted estimates several-fold (Aranda & Easterbrook 2005).
- **Overconfident intervals.** When software professionals give ranges they are "90% sure" contain the true effort, the ranges contain it far less often, commonly 60–70% of the time (Jørgensen, Teigen & Moløkken 2004).
- **Confirmation bias.** People test their beliefs with cases that would confirm them (Wason 1960). Developers write tests that show the code working.
- **Escalation of commitment.** Decision-makers who are responsible for a failing course of action invest more in it (Staw 1976). Keil documented the pattern in runaway IT projects.
- **Hindsight bias.** Once the outcome is known, it seems to have been predictable (Fischhoff 1975). Incident reviews then find "obvious" errors (§13).
- **Substitution.** A hard question (will this architecture hold in five years?) is silently replaced by an easy one (do I like it? does the presenter seem competent?).

**What you must understand.**
- **When intuition can be trusted.** Kahneman and Klein, who started from opposite positions, agreed on the conditions (2009): skilled intuition develops where the environment has stable regularities and the person gets prompt, clear feedback. It does not develop otherwise, though the feeling of confidence appears either way.

  | Activity | Feedback | Expected calibration |
  |---|---|---|
  | Writing code against a compiler and tests | Seconds to minutes, unambiguous | Good |
  | Debugging | Minutes to hours | Good |
  | Estimating a project | Months, confounded | Poor |
  | Choosing an architecture | Years, confounded, rarely attributed | Poor |
  | Judging whether a specification is understood | At delivery, if ever | Poor |

  Seniority improves the first rows much more than the last. Experienced engineers are right to trust their sense that a piece of code is wrong and should distrust their sense of how long a project will take.
- **The outside view.** Reference-class forecasting (Kahneman & Lovallo 1993) replaces the inside view with the distribution of outcomes for similar past cases. It is the best available correction and has its own judgment problem: choosing the class (§21).
- **Reason is social.** Mercier & Sperber (2017) argue that human reasoning evolved to produce and evaluate arguments in groups. On that account, individuals are biased toward their own conclusions and lazy in checking them, and are much better at evaluating the arguments of others. The evidence for the asymmetry is good. The practical corollary is that design review, code review, and structured disagreement are not overhead on individual reasoning. They are the setting in which reasoning works.
- **Caution about the literature.** Social psychology's replication crisis removed or shrank several famous effects (social priming, ego depletion). Anchoring, the planning fallacy, overconfidence, and hindsight bias have replicated robustly. The popular "Dunning–Kruger effect" is partly a statistical artifact and should not be cited as established **[contested]**.

---

### 16e. Understanding is a capacity, not a content

**The constraint.** To understand a system is to be able to do things with it: explain why it is as it is, predict how it will behave in a new case, and change it in a way that fits. That ability lives in a particular person as the result of their own activity. It cannot be handed over. Another person can only grow their own, by doing comparable work, helped by those who already have it.

**What you must understand.**
- **Knowing how and knowing that.** Ryle (1949) argued that intelligent performance is not the application of previously considered propositions. If it were, applying the propositions intelligently would require further propositions, without end. Skill is prior to its description.
- **Programming as theory building.** Naur (1985) applied Ryle directly. What programmers build is primarily a *theory* in Ryle's sense: an understanding of how the program relates to the affairs it handles. Someone who has it can explain each part of the program, justify it against alternatives, and respond to new demands by modifying the program consistently. Naur drew three conclusions:
  1. The theory cannot be fully expressed in code or documentation.
  2. A program whose team has dispersed is, in his word, dead, even if it still runs.
  3. Reviving it from the text alone is impossible in the strict sense. A new team builds a *new* theory, at high cost, which may or may not match the old one.

  I rate the first two **well supported** by experience and by the turnover studies in §18, and the third **overstated but directionally right**: teams do take over systems, and it costs them a large share of what building the theory cost originally.
- **The stages of skill.** Dreyfus & Dreyfus (1986) described five stages from novice to expert. Novices follow context-free rules. Experts perceive situations directly as calling for certain actions and reach for rules mainly when something is unfamiliar. The model is descriptive and hard to test, but its central claim fits the expertise literature: becoming expert means needing explicit rules less, which is the opposite of what rule-based process improvement assumes.
- **The expert blind spot.** Experts underestimate how hard their domain is for beginners and skip steps that have become invisible to them (Nathan & Petrosino 2003). The person best able to do a task is often badly placed to specify it.
- **Mental models.** People reason with internal models of how things work (Johnson-Laird 1983). Norman (1983) observed that such models are incomplete, unstable, and unscientific, and that people nonetheless act on them confidently. Users' models of a system and developers' models of the users' work are both of this kind.
- **Individual differences are large.** The famous "10×" figure comes from Sackman, Erikson & Grant (1968), a study with serious design flaws. Better-controlled data still show variation of roughly two- to four-fold between individuals on the same task (Prechelt 2000) **[verify]**. Staffing models that treat developers as interchangeable units ignore the largest variable they have (§21).
- **Cognition is distributed.** Hutchins (1995) showed, in a study of ship navigation, that the unit which knows and computes is often a group of people together with their instruments and representations. A team with its code base, tests, tools, and habits knows things that no member knows alone. Breaking up the team destroys knowledge that no exit interview could capture (§18, §19).

**What goes wrong.**
- A team is replaced and given the documentation. Velocity collapses for a year (§18).
- A developer reads a design and can recite it, and then extends it in a way that violates its intent.
- Managers plan as if a person's understanding moved with a ticket reassignment.
- An organization measures knowledge by documents produced.

---

### Trade-offs and alternatives (set 16 as a whole)

| Goal | Approach A (cost) | Approach B (cost) |
|---|---|---|
| Stay within working memory | Small, deep modules and strong conventions (design effort; less local freedom) | Rely on individual capacity (works for the few who hold it all; fails on turnover) |
| Get an expert's knowledge | Interview and document (cheap; collects verbal reconstructions) | Observe work, build prototypes, work together (slow and costly; reaches what is not verbalized) |
| Check shared understanding | Document review and sign-off (cheap; tests agreement on wording) | Have each party derive examples and tests; show working software (costs time; tests the model) |
| Improve judgment | Individual expertise (good where feedback is fast) | Outside view, premortems, structured review (overhead; needed where feedback is slow) |
| Spread understanding | Documentation (scales; carries information, not capacity) | Pairing, rotation, overlap (does not scale; carries capacity) |
| Reduce load on people | Automate and generate (removes practice; see note below) | Keep people in the loop (slower; keeps understanding alive) |

### Contested points

- **The role of language in thought.** Fedorenko and colleagues against researchers who give language a constitutive role in some kinds of thinking (for example Carruthers, and Chomsky from a very different direction). The dissociation data favour the former for the adult brain. The developmental and scaffolding questions are open.
- **Whether anyone lacks inner speech entirely.** Proposed by Nedergaard & Lupyan (2024); disputed in a 2025 commentary. Self-report is a weak instrument here.
- **What neuroimaging can show.** An inactive language network during reasoning is strong evidence against language as the substrate. Critics note the limits of fMRI's temporal resolution and of inference from group averages. The lesion evidence does not share those limits, which is why the combination is persuasive.
- **Heuristics as biases or as tools.** Kahneman and Tversky stressed error. Gigerenzer and colleagues argue that simple heuristics are well adapted to real environments and often outperform complex models. Both have evidence; the disagreement is partly about which environments count.
- **Deliberate practice.** Ericsson held that expertise is mainly the product of structured practice. A meta-analysis (Macnamara, Hambrick & Oswald 2014) found that practice explained a modest share of performance differences and very little in professional work. Talent, opportunity, and working conditions account for the rest in proportions nobody has established.
- **Naur's strong claim.** Whether a theory truly cannot be revived from artifacts, or whether it is merely very expensive. See 16e.
- **Applying all of this to software.** Most of the cited experiments used students, short texts, or laboratory tasks. Transfer to professional requirements work is plausible and largely untested. **Tentative.**

### Examples

**Example 16.1 — The clothes-washing effect in a specification.** A requirement reads: *"After the items have been grouped, the procedure is applied to each group; items that fail are set aside and handled separately."* An accountant reads a reconciliation process. A developer reads a batch job with a dead-letter queue. A lawyer reads a review of submitted documents with a right to be heard for rejected ones. Each finds the sentence clear. The missing title is the shared context that the author had and the document did not carry.

**Example 16.2 — Probing a model instead of asking for agreement.** For a rule "a reminder is sent when an obligation is overdue", ask each stakeholder separately:
1. The report was submitted yesterday and rejected today for a formal error. Is the obligation overdue?
2. The deadline was Saturday. Is it overdue on Sunday?
3. The person was added to the register after the deadline. Do they get a reminder?
4. A reminder was sent yesterday and the system was restored from backup. Is another sent?

Divergent answers locate the differences between models at a cost of minutes. A review of the sentence itself would have found none.

**Example 16.3 — Calibrating an estimate.** A team estimates a feature at 6 weeks, by decomposition. The outside view: of the team's last twelve features of similar apparent size, the median took 1.6 times the estimate and two took more than 3 times. The calibrated statement is a median of about 10 weeks with roughly one chance in six of exceeding 18. The inside view produced a number. The outside view produces a distribution that a sponsor can plan against (§21).

### Key literature

1. **Fedorenko, E., Piantadosi, S. T. & Gibson, E. A. F. (2024). "Language Is Primarily a Tool for Communication Rather than Thought." *Nature* 630, 575–586.** DOI: 10.1038/s41586-024-07522-w — *Recent; verified.* The synthesis of lesion, imaging, and linguistic evidence for the dissociation of language and thought.
2. **Ivanova, A. A., Srikant, S., Sueoka, Y., Kean, H. H., Dhamala, R., O'Reilly, U.-M., Bers, M. U. & Fedorenko, E. (2020). "Comprehension of Computer Code Relies Primarily on Domain-General Executive Brain Regions." *eLife* 9:e58906.** DOI: 10.7554/eLife.58906 — *Recent; verified.* Code comprehension engages the multiple-demand network, not the language network. Published with a companion paper by Liu et al. reaching a compatible result.
3. **Cowan, N. (2001). "The Magical Number 4 in Short-Term Memory: A Reconsideration of Mental Storage Capacity." *Behavioral and Brain Sciences* 24(1).** — *Seminal.* The modern estimate of working-memory capacity.
4. **Bransford, J. D. & Johnson, M. K. (1972). "Contextual Prerequisites for Understanding: Some Investigations of Comprehension and Recall." *Journal of Verbal Learning and Verbal Behavior* 11(6).** — *Seminal.* The demonstration that comprehension depends on context supplied before reading.
5. **Yeshurun, Y., Swanson, S., Simony, E., Chen, J., Lazaridi, C., Honey, C. J. & Hasson, U. (2017). "Same Story, Different Story: The Neural Representation of Interpretive Frameworks." *Psychological Science* 28(3), 307–319.** DOI: 10.1177/0956797616682029 — *Recent; verified.* Shared interpretation produces shared neural responses; different priors produce different ones.
6. **Tversky, A. & Kahneman, D. (1974). "Judgment under Uncertainty: Heuristics and Biases." *Science* 185(4157).** — *Seminal.* With **Kahneman, D. & Klein, G. (2009). "Conditions for Intuitive Expertise: A Failure to Disagree." *American Psychologist* 64(6)** for when intuition is and is not trustworthy.
7. **Naur, P. (1985). "Programming as Theory Building." *Microprocessing and Microprogramming* 15(5), 253–261.** — *Seminal.* The program as a theory held by people.
8. **Mahowald, K., Ivanova, A. A., Blank, I. A., Kanwisher, N., Tenenbaum, J. B. & Fedorenko, E. (2024). "Dissociating Language and Thought in Large Language Models." *Trends in Cognitive Sciences* 28(6).** — *Recent.* Formal versus functional linguistic competence.

Also: **Kintsch, W. (1998). *Comprehension: A Paradigm for Cognition*. Cambridge University Press.** **Ferreira, F., Bailey, K. G. D. & Ferraro, V. (2002). "Good-Enough Representations in Language Comprehension." *Current Directions in Psychological Science* 11(1).** **Nedergaard, J. S. K. & Lupyan, G. (2024). "Not Everybody Has an Inner Voice: Behavioral Consequences of Anendophasia." *Psychological Science*.** DOI: 10.1177/09567976241243004 (verified; disputed by a 2025 commentary in the same journal). **Mercier, H. & Sperber, D. (2017). *The Enigma of Reason*. Harvard University Press.** **Hutchins, E. (1995). *Cognition in the Wild*. MIT Press.**

### Self-check questions

1. A method has six boolean parameters. Using Cowan's limit and the notion of a chunk, explain why an expert in that code base may find it manageable and a newcomer cannot. What would you change so that it does not depend on who reads it?
2. State precisely what the aphasia and imaging evidence shows about language and thought, and name two things it does not show.
3. A domain expert explains her decision procedure fluently in an interview. Give two reasons from 16b why the explanation may differ from what she actually does, and one method that would reveal the difference.
4. Five reviewers approve a specification. What have you learned about whether they share an understanding? Design a thirty-minute activity that would tell you more.
5. For which of your own professional judgments do you receive fast, unambiguous feedback, and for which not? What follows for how much you should trust each?
6. A team is to be replaced in three months. Using 16e, say what can be transferred by documents, what cannot, and how you would use the three months.

---

### Note on the current moment: language models and agentic coding

*Status: tentative throughout. The evidence is recent, the tools change every few months, and several claims below rest on one or two studies.*

**What has changed.** Since about 2023, language models have been able to write code from natural-language instructions. Since 2025, agents built on them can plan, edit across files, run tests, and iterate with little supervision. The cost of producing code from a stated intent has fallen sharply.

**What this does to the constraints of Part III.**

1. **It isolates the intent problem.** When writing the code was expensive, weak specifications could be blamed on lack of time and repaired during implementation, when the developer met each ambiguity and resolved it, often silently. With an agent implementing, the stated intent is nearly all that the implementer has. The quality of intent formation and of verification becomes the limiting factor. This is the practical test mentioned at the start of Part III.

2. **It adds a reader with different priors.** A model completes an underspecified instruction with the statistically typical interpretation from its training data, not with the local context of the project. It does so fluently and without signalling doubt. Section 16c applies with one change: the reader's prior is the average of public code and text, and not a colleague's partly shared understanding.

3. **It separates fluent text from held understanding.** Code and explanations can now be produced that nobody has a theory of, in Naur's sense. The code may be correct. The capacity to explain, justify, and extend it consistently exists only if a person builds it by studying the result, and reading is a weaker way to build a theory than writing (16e).

**Evidence on productivity.**
- A randomized controlled trial by METR (Becker et al. 2025) had 16 experienced open-source developers complete 246 real tasks in mature repositories they knew well, with AI tools allowed or disallowed at random. With AI allowed, tasks took **19% longer**. The developers had predicted a 24% speed-up beforehand and still believed afterwards that they had been about 20% faster. Contributing factors identified by the authors include the developers' deep familiarity with their repositories, the size and maturity of the code bases, and the tools' lack of the project's implicit context.
- The authors caution against generalizing: the sample is small, the setting is specific, and the tools were those of early 2025. A follow-up reported in early 2026 ran into selection problems, because many developers were no longer willing to work without AI, and gave inconclusive results **[verify]**.
- Other studies, on smaller or less familiar tasks and less experienced developers, report substantial gains in output measures.
- **A reading consistent with Part III:** the benefit is largest where the task depends least on a locally held theory, and smallest or negative where it depends most. The perception gap in the METR study is an instance of 16d: producing code feels fast, and the slow, confounded feedback on total time does not correct the feeling.

**Bainbridge again** (§13). Supervising generated work requires exactly the understanding that doing the work used to build. An organization that moves its developers from writing to reviewing has to ask where the next generation's understanding will come from. For developers at the start of their careers, directing agents may speed up theory building, by letting them explore and question more, or may replace it. There is no good evidence yet in either direction.

**What does not change.**
- The world still has to be mapped to a formal description by someone who understands both (§17).
- A text, whether a specification or a prompt, still does not determine its interpretation (§17).
- Project-specific knowledge that was never written is in no model's training data (§18).

**What may be new and useful.** A model is a cheap, tireless second reader. Asking an agent to restate a requirement, list the assumptions it made, generate boundary examples, or write the acceptance tests before any code makes interpretive differences visible in minutes instead of at delivery. That is the probing technique of Example 16.2, automated. It does not tell you what the stakeholders meant. It tells you quickly that the text leaves the question open, which was previously the expensive thing to find out.

**The formal-verification variant.** Having a model write code and proofs against a formal specification (for example in Dafny) removes one source of doubt: the proof checker does not depend on anyone's interpretation. What remains is whether the formal specification says what was intended. That question concentrates all of §17 into one artifact. It is a better place to have the argument than scattered through the code.

---

## 17. Language, meaning, and specification

### The constraint

Natural language is the only medium that all the parties to a software project share. It has four properties that cannot be engineered away.

- **Words underdetermine meaning.** What a sentence communicates on an occasion depends on context, purpose, and what speaker and hearer take each other to know. The linguistic form is a clue to the intended meaning, not an encoding of it.
- **No text fixes its own interpretation.** Any rule, definition, or clarification is more text, which again has to be applied by someone to a case it does not mention.
- **Requirements are about the world, not about the machine.** The world is informal, partly unknown to every participant, and changed by the introduction of the system (§15, E-type). The step from the world to a formal description is a creative act that can be checked only by people.
- **The alternative, formal language, is exact and unreadable to most stakeholders.** It moves the problem of interpretation to the boundary between the formal text and the people who must confirm it says what they want.

Together these establish the valid core of thesis T1. A specification cannot be made complete, unambiguous, and stable in advance, and adding detail does not converge on that state.

### What goes wrong

- **Unnoticed ambiguity.** The dangerous ambiguities are those nobody sees. Each reader resolves the sentence one way without becoming aware that there was a choice (Berry, Kamsties & Krieger 2003 call this subconscious disambiguation). Chantree et al. (2006) distinguish *innocuous* ambiguity, which all readers resolve alike, from *nocuous* ambiguity, which they resolve differently.
- **Kinds of ambiguity and their relatives.**

  | Kind | Example | 
  |---|---|
  | Lexical | "The report is *closed*": finished, locked, or archived? |
  | Syntactic (attachment) | "Notify users with overdue obligations and administrators": administrators with overdue obligations, or all administrators? |
  | Scope | "Every report must be approved by an official": the same official for all, or some official for each? |
  | Referential | "If the applicant has a representative, *they* must sign" |
  | Pragmatic | "The system should allow export to Excel": must it, and all data or the visible page? |
  | Vagueness | "promptly", "user-friendly", "a reasonable time" |
  | Generality | "Changes are logged": which changes, to what, with what content? |

- **One word, several concepts.** "Submitted" means received by the server to the developer, signed to the lawyer, and passed validation to the case handler. The legal deadline depends on which (§3).
- **What is too obvious to say.** Domain experts omit what every colleague knows. Empirically, missing requirements are a larger problem than wrong ones (see NaPiRE below).
- **Solutions stated as requirements.** "There must be a button to recalculate" conceals the need that produced it.
- **Constructive ambiguity.** Stakeholders who disagree settle on wording vague enough for each to accept. This is a normal and useful technique in negotiation and legislation. In a specification it postpones the disagreement to the developer, who resolves it without authority.
- **Chains of interpretation.** Statute → regulation → internal procedure → analysis document → user story → code → test. Each arrow is a reading by a different person with different background knowledge (§16c).
- **Open texture in rules.** Hart's example (1961): a rule forbids vehicles in the park. Does it cover a bicycle, an ambulance, a war memorial made from a tank? Every general rule has a core of clear cases and a fringe where application requires judgment about purpose. Code must decide every fringe case in advance.
- **The system changes the practice.** Once deployed, the software alters how people work, and the requirements that were gathered describe a practice that no longer exists.

### What you must understand

**The world and the machine.** Jackson (1995) and Zave & Jackson (1997) gave requirements engineering its clearest frame. Distinguish:
- **W**, the *domain knowledge*: statements about how the world is and behaves, regardless of the system.
- **R**, the *requirement*: what is wanted to be true in the world.
- **S**, the *specification*: what the machine must do at its interface with the world.

The obligation is to show that **S and W together entail R**. Three consequences:

1. **Requirements are not about the software.** "Persons with an overdue obligation receive a reminder" is a statement about people and letters. The software can only emit a message to an address.
2. **Many failures are failures of W.** The specification was met and the requirement was not, because a domain assumption was false. The textbook case is the 1993 Lufthansa A320 overrun at Warsaw. Braking systems were enabled when the aircraft sensed it was on the ground, defined by weight on both main gear or wheel spin. On a wet runway in a crosswind neither condition held for several seconds after touchdown. The software did what was specified. The assumption linking the sensed condition to "the aircraft has landed" was wrong.
3. **Validation is not verification.** *Verification* asks whether the program satisfies S. That can in principle be formalized and even proved. *Validation* asks whether S and W capture what is wanted and what is true. That requires people who know the domain to judge an informal matter. No amount of rigour on the formal side reaches across.

This is the precise version of thesis T2. Formalization works. The link between a formalization and the world it is about does not formalize.

**Communication is inference.** Three converging accounts from linguistics:
- **Grice (1975).** Hearers assume speakers are cooperative, and derive much of what is communicated from that assumption (*implicature*). "Some reports were late" communicates "not all", which the words do not say.
- **Relevance theory** (Sperber & Wilson 1986). The words are evidence of the speaker's intention. The hearer infers the interpretation that makes the utterance relevant enough to be worth processing, in the context the hearer has. Change the context and the same sentence yields a different interpretation.
- **Contextualism** (Recanati 2004; Travis). Even the literal truth conditions of a sentence often depend on the occasion. Whether "the form is complete" is true depends on what completeness is for in the situation.

**The conduit metaphor.** Reddy (1979) showed that ordinary English talks about communication as packing meanings into words and sending them across: "put it into words", "get the idea across", "the document contains the requirements", "I didn't get much out of it". The metaphor implies that a well-packed message delivers its content intact and that failure is the fault of sloppy packing. It is built into project vocabulary: requirements are *captured*, *gathered*, *handed over*, *delivered*. An alternative that fits the evidence of §16c: language is a tool by which one person instructs another to construct something in imagination from the hearer's own experience (Dor 2015), or a continuing improvisation between people who coordinate as they go (Christiansen & Chater 2022).

**Common ground and grounding.** H. Clark (1996) treats language use as joint action. Speakers rely on *common ground*, the knowledge each believes they share. Adding to it requires *grounding*: the speaker presents something, and the hearer gives evidence of having understood it well enough for present purposes, by acknowledging, answering relevantly, or acting on it. Without that evidence nothing has been communicated, only said.

Clark & Brennan (1991) compared media by what they offer for grounding:

| Property | Face to face | Video call | Chat | Document |
|---|---|---|---|---|
| Can see what the other is looking at | Yes | Partly | No | No |
| Immediate reaction | Yes | Yes | Roughly | No |
| Can interrupt and repair at once | Yes | Yes | Roughly | No |
| Persists and can be revised | No | No | Yes | Yes |

A document is the worst medium for establishing shared understanding and the best for creating a durable, inspectable record. Institutions need the record (§20–§22), so they choose the document, and then treat it as if it had also done the grounding.

**The rule-following problem.** Wittgenstein (*Philosophical Investigations*, 1953, §§185–242) observed that any rule, however explicitly stated, is compatible with more than one way of going on. A pupil taught to "add 2" who continues 1000, 1004, 1008 has followed *some* rule consistent with every example given. Supplying a further rule to interpret the first begins a regress. Kripke's 1982 discussion made the argument famous among philosophers. Wittgenstein's resolution: the regress ends in shared practice. People trained in the same way simply go on in the same way, and correct each other when they do not.

For specifications this means:
- **More detail does not converge on determinacy.** Each clarification is new text needing interpretation.
- **What actually fixes interpretation** is common training and practice, worked examples, and correction through feedback, above all from running software.
- **Examples help more than definitions and still underdetermine the rule.** A finite set of cases is consistent with many generalizations. Examples, a stated rule, and conversation each cover part of what the others leave open.

**Meaning as inferential role.** On Brandom's account (1994), to understand a claim is to know what follows from it, what it follows from, and what it rules out. This gives an operational test of whether someone has understood a requirement: can they draw the right consequences in cases the text does not mention? It is the same test as in §16c, reached from philosophy instead of psychology.

**Wicked problems.** Rittel & Webber (1973) described a class of planning problems with these properties, among others: there is no definitive formulation; understanding the problem and proposing a solution are the same activity; there is no stopping rule; solutions are better or worse, not true or false; every attempt changes the problem. Much of public-sector software falls in this class. The vocabulary of *eliciting* or *gathering* requirements assumes they already exist somewhere. They are constructed, in negotiation, through attempts.

**What formal specification does and does not buy.**

| It buys | It does not buy |
|---|---|
| Internal consistency checking: contradictions are found mechanically | Assurance that the formal text matches intent |
| Exposure of gaps: the tool demands an answer for every case | Readability for stakeholders, so validation needs translation back into examples and prose |
| Machine-checked conformance of design or code to the specification | Correct domain assumptions (W) |
| A precise object to argue about | Stability when the world changes |

Experience supports the left column. Engineers at Amazon Web Services reported that model checking designs in TLA+ found serious defects that had passed design review and testing (Newcombe et al. 2015). Formalizing legislation exposes problems in the legislation: the Catala project, encoding French tax and benefits law, found inconsistencies and gaps in the statutory text (Merigoux, Chataing & Protzenko 2021). Earlier, Sergot et al. (1986) encoded the British Nationality Act as a logic program and met the open-texture problem directly.

The same work illustrates the right column. Encoding a statute forces a decision wherever the text is vague or silent. The legislator did not make that decision. Whoever writes the formal rule does (§23). Formal methods therefore do something more useful than "remove ambiguity": they **find it, concentrate it, and force it to be decided by someone**. The remaining question is whether that someone has the authority.

**What the empirical record says.** The NaPiRE survey family (Méndez Fernández et al. 2017; 228 companies in 10 countries) asked practitioners which requirements problems they meet and what follows from them. The most frequently reported problems were incomplete or hidden requirements, communication flaws between the project team and the customer, moving targets, and underspecified requirements **[verify the exact ranking]**. These are problems of knowledge and communication, not of notation.

Two pieces of folklore deserve caution:
- **The cost-of-change curve.** Boehm (1981) reported that fixing a requirements defect late costs up to a hundred times more than fixing it early. Later analysis of data from 171 projects found no evidence that delayed issues were harder to resolve (Menzies et al. 2017).
- **The Standish "CHAOS" figures** on project failure rest on undisclosed methods and a definition of success as meeting the original estimate (Eveleens & Verhoef 2010).

The honest summary is that requirements problems are consistently reported as important, and that the quantitative claims in common circulation are weaker than their reputation.

**Techniques and what each addresses.**

| Technique | Reduces | Leaves untouched |
|---|---|---|
| Sentence templates and controlled language (for example EARS, Mavin et al. 2009) | Syntactic ambiguity; some omissions (triggers, conditions) | Pragmatic ambiguity; missing domain knowledge |
| Glossary and ubiquitous language (§11) | Lexical ambiguity, if maintained and used in speech | Different concepts hiding behind an agreed word |
| Concrete examples and acceptance tests (Adzic 2011) | Interpretive variance at the cases covered | Cases not covered; the generalization |
| Prototypes and working increments | Differences between mental models, quickly | Cost; rarely exercised paths |
| Formal models | Inconsistency and incompleteness | Validity against intent; readability |
| Co-location and frequent conversation with domain experts | Grounding cost | Legibility for outsiders; availability of experts |
| Domain modelling workshops | Unshared concepts, early | Depends on who is in the room |

No row covers everything. The combination that covers most is a short rule, concrete examples including boundary cases, and a fast way to see the result.

**Boundary objects.** Star & Griesemer (1989) studied how groups with different expertise cooperate without sharing an understanding. They found artifacts that each group could use in its own way and that still held a common identity across groups: maps, standard forms, specimen collections. They called these *boundary objects*. A specification, a data model, a prototype, and a test suite work this way. The legal department reads the specification as a statement of obligations, the developer as a work description, the tester as an oracle. It coordinates their work without making their understandings identical. This is a realistic description of what a specification is for, and it is the positive replacement for the conduit picture.

**Iteration as a consequence.** If understanding can be checked only through consequences (§16c), and if the regress of interpretation ends only in practice and feedback, then short cycles of building and showing are not a methodological preference. They follow from the constraints. They also have preconditions that are institutional: access to people who do the real work, and a contract that permits what is learned to change what is built (§22).

**Specifications for agents.** The same theory applies to a prompt or a specification given to a language-model agent, with the differences noted in §16: the reader's priors are generic, and it does not ask. The grounding steps have to be requested explicitly: restate, list assumptions, propose examples, write tests first. **Tentative.**

### Trade-offs and alternatives

| Approach | Gains | Costs |
|---|---|---|
| **Detailed prose specification in advance** | Contractible; reviewable; legible to governance | Long; unread; stale; false confidence; ambiguity unnoticed |
| **Brief intent plus continuous conversation** | Cheap grounding; adapts | Leaves little record; depends on stable people; hard to contract |
| **Specification by example** | Tests understanding at concrete cases; executable | Effort; examples may be mistaken for the whole rule |
| **Prototype first** | Fast discovery of model differences | Prototype mistaken for product; surface gets attention, rules do not |
| **Formal model of the core rules** | Finds contradictions and gaps; precise basis for tests and proofs | Skill and effort; a second language to validate; fits rule-heavy cores, not whole systems |
| **Rules as code alongside the legal text** | Legislation and implementation checked against each other early | Requires legal authority in the loop; freezes interpretive choices |
| **Domain expert inside the team** | Lowest grounding cost; tacit knowledge present (§18) | Scarce people; one person's view of the domain |

### Contested points

- **Can ambiguity be eliminated?** The formal-methods tradition holds that natural-language specification is the problem and precise notation the cure. The pragmatic and ethnographic tradition holds that meaning is fixed by practice and no notation escapes that. The position of this article: both are right about different sides of the world/machine boundary. Inside the machine, formal precision is achievable and valuable. Across the boundary it is not available.
- **How much to decide up front.** Advocates of plan-driven development and advocates of agile methods each have failure stories about the other. Boehm & Turner (2004) proposed that the right balance depends on criticality, team size, stability of requirements, and culture. That view has aged better than either pole. Its weakness is that it gives a list of factors and no way to weigh them.
- **Are formal methods cost-effective?** Demonstrated for compilers, kernels, protocols, and distributed-system designs. For business systems the evidence is a small number of case reports. Language-model assistance is lowering the cost of writing proofs; whether that changes the economics is open **[tentative]**.
- **Rules as code.** Supporters see fewer implementation errors and earlier detection of drafting problems. Critics see a transfer of interpretive authority to technical staff and a loss of the discretion that law deliberately leaves (§23). Leith (1986) made the fundamental objection early: legal rules are not the kind of thing a logic program represents.
- **How far the cognitive-science findings reach.** That language is not the medium of thought (§16b) is suggestive for requirements work. Nobody has shown experimentally that it explains requirements failures. **Tentative**, and stated as such.
- **Do language models understand?** Bender & Koller (2020) argued that a system trained only on form cannot learn meaning. Others reply that the internal representations learned from text are richer than the argument allows. The practical question for this set is narrower: a model can generate consequences of a text that help humans notice ambiguity, whether or not it understands anything.

### Examples

**Example 17.1 — The decisions inside one sentence.** *"A report is on time if it is submitted by the end of the deadline day."*

| Phrase | Decision the text does not make |
|---|---|
| "submitted" | Upload received? Signature completed? Validation passed? Receipt issued? |
| "by the end of" | Before 24:00, or including a grace period? Server clock or client clock? (§3) |
| "the deadline day" | In which time zone? What if it falls on a weekend or public holiday? Is a general rule of law on deadlines applicable? |
| "a report" | If rejected for a formal defect and resubmitted after the deadline, which submission counts? |
| (unstated) | The service was unavailable from 23:40 to 00:20. |
| (unstated) | A representative submitted without valid authorization, which was granted the next day. |

Each row was obvious to somebody and never considered by somebody else. A developer will decide every one of them, because code cannot leave them open. The useful outcome of analysis is this table with an authorized answer in each row, plus the two or three examples per row that make the answer unmistakable.

**Example 17.2 — S, W ⊢ R for a reminder.**

- **R** (requirement): every person with an overdue obligation becomes aware of it within three days.
- **S** (specification): for each obligation whose due date has passed and which has no accepted report, the system sends one message to the person's registered contact address within 24 hours.
- **W** (domain assumptions): (1) the register of obligated persons is complete and correct; (2) the registered address reaches the person; (3) a sent message is read within two days; (4) "no accepted report" corresponds to "has not fulfilled the obligation".

The developers can verify S. R holds only if W does. Assumption 2 fails for lapsed addresses; 4 fails for reports under review. A reminder system that is fully correct against S can still fail R for exactly the people who most need it. Writing W down is the cheapest requirements technique there is, because it shows whom to ask.

**Example 17.3 — A scope ambiguity made visible.** "Every report must be approved by an official."

- Reading A: for each report there is some official who approved it. ∀r ∃o Approved(o, r)
- Reading B: there is one official who approved every report. ∃o ∀r Approved(o, r)

Nobody intends B here, so the ambiguity is innocuous. Change the sentence to "every report in a group filing must be approved by an official" and both readings are plausible: one approver per report, or one approver for the whole filing. The formal notation does not tell you which is right. It tells you there is a question.

### Key literature

1. **Wittgenstein, L. (1953). *Philosophical Investigations*. Blackwell.** — *Seminal.* The rule-following considerations (§§185–242) and meaning as use. With **Kripke, S. (1982). *Wittgenstein on Rules and Private Language*. Harvard University Press** for the sharpest statement of the problem.
2. **Reddy, M. J. (1979). "The Conduit Metaphor: A Case of Frame Conflict in Our Language about Language." In A. Ortony (ed.), *Metaphor and Thought*. Cambridge University Press.** — *Seminal.* The folk theory of communication embedded in everyday vocabulary.
3. **Clark, H. H. & Brennan, S. E. (1991). "Grounding in Communication." In Resnick, Levine & Teasley (eds.), *Perspectives on Socially Shared Cognition*. APA.** — *Seminal.* Grounding and its cost in different media. See also **Clark, H. H. (1996). *Using Language*. Cambridge University Press.**
4. **Sperber, D. & Wilson, D. (1986). *Relevance: Communication and Cognition*. Blackwell.** (2nd ed. 1995.) — *Seminal.* Communication as inference from evidence of intention.
5. **Zave, P. & Jackson, M. (1997). "Four Dark Corners of Requirements Engineering." *ACM Transactions on Software Engineering and Methodology* 6(1).** With **Jackson, M. (1995). "The World and the Machine." ICSE '95.** — *Seminal.* The S, W ⊢ R frame and the distinction between domain knowledge, requirements, and specification.
6. **Rittel, H. W. J. & Webber, M. M. (1973). "Dilemmas in a General Theory of Planning." *Policy Sciences* 4(2).** — *Seminal.* Wicked problems.
7. **Méndez Fernández, D., Wagner, S., Kalinowski, M., et al. (2017). "Naming the Pain in Requirements Engineering: Contemporary Problems, Causes, and Effects in Practice." *Empirical Software Engineering* 22(5), 2298–2338.** DOI: 10.1007/s10664-016-9451-7 — *Recent; verified.* The broadest survey evidence on which requirements problems practitioners actually have.
8. **Merigoux, D., Chataing, N. & Protzenko, J. (2021). "Catala: A Programming Language for the Law." *Proceedings of the ACM on Programming Languages* 5 (ICFP).** — *Recent.* A language designed for faithful encoding of statutes, and what encoding revealed about the statutes.

Also: **Suchman, L. A. (1987). *Plans and Situated Actions*. Cambridge University Press.** **Star, S. L. & Griesemer, J. R. (1989). "Institutional Ecology, 'Translations' and Boundary Objects." *Social Studies of Science* 19(3).** **Berry, D. M., Kamsties, E. & Krieger, M. M. (2003). *From Contract Drafting to Software Specification: Linguistic Sources of Ambiguity*** (handbook, University of Waterloo). **Newcombe, C., et al. (2015). "How Amazon Web Services Uses Formal Methods." *Communications of the ACM* 58(4).** **Dor, D. (2015). *The Instruction of Imagination*. Oxford University Press.** **Christiansen, M. H. & Chater, N. (2022). *The Language Game*. Basic Books.** **Hart, H. L. A. (1961). *The Concept of Law*. Oxford University Press.**

### Self-check questions

1. Take a requirement from a current project. Write down R, S, and W separately. Which statements in W has anyone checked?
2. Explain, using the rule-following argument, why adding a clarifying paragraph to a specification does not in principle end disputes about its meaning. What does end them in practice?
3. Give an example of nocuous ambiguity from your own experience. At what point was it discovered, and which technique from the table would have exposed it earliest?
4. Using Clark and Brennan's analysis, explain why a reviewed and signed document is weak evidence of shared understanding and strong evidence of something else. What is the something else?
5. A statute says a fee is waived "in justified cases". You must implement it. What are your options, who has the authority to choose among them, and what does each do to the discretion the legislator left?
6. A formally verified deadline calculation is rejected by the legal department as wrong. Classify the possible locations of the error using verification, validation, and W.

---

## 18. Knowledge that does not survive conversion into text

### The constraint

Much of what a team knows exists as skill, perception, shared habits, and knowledge of who knows what. It cannot be fully stated. What can be stated becomes knowledge again only in a reader who already has most of the context needed to use it.

Knowledge is therefore **located**: in particular people and in particular groups working together. It leaves when they leave. A document is information. Whether it becomes knowledge depends on who reads it.

### What goes wrong

- **Handover by document.** A departing team writes comprehensive documentation. The new team reads it, can find things, and cannot change the system safely for months.
- **Supplier change.** A re-tender awards maintenance to a new company. The code and documents are transferred, as the contract requires. The understanding is not, because the contract cannot require it (§22). Naur's "death of a program" becomes a scheduled event.
- **The single holder.** One person knows how the monthly close, the restore, or the integration with the legacy register works. Avelino et al. (2016) estimated that most popular open-source projects they examined would stall if one or two developers left **[verify figures]**.
- **Documentation rot.** A wiki grows until nobody trusts any page.
- **Interviews that miss the point.** Experts answer the questions they are asked, in terms of official procedure, and leave out the exceptions and workarounds that make the procedure function (§16b, §16e).
- **Separate analysis and build contracts.** One supplier produces the analysis; another builds from it. The understanding formed during analysis is discarded and only its written residue crosses the boundary.
- **Outsourcing everything.** An organization that has contracted out all development for years can no longer judge an offer, a design, or a delivered system (see *absorptive capacity* below).
- **Onboarding by reading.** New members are given documents for two weeks and then expected to contribute.
- **Agent context files.** Instruction files for coding agents record conventions and commands. They are explicit knowledge and useful. They do not contain why the system is shaped as it is, and an agent that follows them still lacks the theory (§16, note).

### What you must understand

**Tacit knowing.** Polanyi (1966) began from the observation that "we can know more than we can tell". We recognize a face without being able to say how. A skilled performer attends *from* the particulars of the skill *to* its object, and cannot attend to the particulars without disrupting the performance. Tacit knowledge on this account is not a stock of unwritten statements. It is the structure of skilled attention.

**Three kinds of tacit knowledge.** Collins (2010) separates what is usually run together:

| Kind | Why it is unstated | Can it be made explicit? | Software example |
|---|---|---|---|
| **Relational** | Nobody asked; it seemed obvious; it was kept back; telling is costly | Yes, in principle and often in practice | Why the batch runs at 03:00; which alternative was rejected and why; the gotcha in the deployment |
| **Somatic** | It resides in the body's and brain's trained responses | Not usefully | Fluency with tools; the experienced reader's instant sense that code is wrong |
| **Collective** | It resides in the practices of a community: knowing how a rule applies in context, what counts as the same, what is reasonable | No. It is acquired only by participating | How this team judges "good enough"; what the department means by "urgent"; how strictly a procedure is really followed |

This taxonomy is the most useful single tool in this set, because it says what documentation is *for*. **Relational tacit knowledge is the proper target of documentation.** It is cheap to write down for someone who has it and expensive to rediscover. The other two kinds are transferred by working together or not at all. Collective tacit knowledge is the practical face of the rule-following argument (§17): it is the shared practice in which interpretation comes to rest.

**An experiment in non-transfer.** Collins (1974) studied laboratories trying to build a new type of laser from published descriptions. None succeeded from the papers alone. Those that succeeded had spent time with people from a laboratory that already had a working one. Some who had such contact still failed until they had more. The published text was complete by the standards of the field and insufficient in practice.

**The knowledge-conversion model and its critics.** Nonaka & Takeuchi (1995) proposed that organizations create knowledge by cycling through socialization, externalization, combination, and internalization ("SECI"), converting tacit to explicit and back. The model shaped a generation of knowledge-management programmes. Critics (Tsoukas 2003; Gourlay 2006) argue that it misreads Polanyi by treating tacit knowledge as unexpressed content awaiting conversion, and that its empirical base is a few anecdotes. In Collins's terms, the model is plausible for relational tacit knowledge and mistaken for the other kinds. Status: **contested**, with the critics better supported.

**Practice, not manuals.** Orr (1996) spent months with photocopier repair technicians. The official documentation prescribed diagnostic procedures. The technicians solved the hard problems by telling each other stories of past repairs, building a shared, living understanding of the machines. Brown & Duguid (1991) generalized: organizations describe work through *canonical* practice (procedures, manuals, job descriptions), and the work gets done through *non-canonical* practice that the official description does not see. Lave & Wenger (1991) described how newcomers learn: by *legitimate peripheral participation*, doing real but limited tasks at the edge of a community of practitioners and moving inward.

**Stickiness.** Szulanski (1996) studied transfers of practices inside firms. The main obstacles were not unwillingness. They were the recipient's lack of *absorptive capacity*, *causal ambiguity* (nobody, including the source, knows exactly which elements of the practice make it work), and a difficult relationship between source and recipient.

**Absorptive capacity.** Cohen & Levinthal (1990) showed that an organization's ability to recognize, assimilate, and apply outside knowledge depends on its own prior related knowledge. Doing some of the work yourself is what makes you able to learn from others who do it. The consequence for sourcing is direct: a client that develops nothing in-house progressively loses the ability to specify, evaluate, and steer what it buys (§21, §22).

**Who knows what.** Wegner's *transactive memory* (1987) is a group's shared map of which member knows which things. In a study of software teams, the coordination of expertise, meaning knowing where it is and bringing it to bear, predicted team performance over and above the amount of expertise present (Faraj & Sproull 2000). Turnover and reorganization destroy this map even when total headcount and skill are unchanged.

**Evidence from software repositories.**
- Components worked on by many low-contribution developers have more defects (Bird et al. 2011).
- Organizational volatility, people leaving and arriving, is associated with more defects in the code they touched (Mockus 2010).
- Knowledge loss from turnover can be quantified from version history as the share of code whose only knowledgeable authors have left; in the projects studied it was substantial and unevenly distributed (Rigby et al. 2016).

**What code review is for.** Bacchelli & Bird (2013) asked developers and managers at Microsoft why they review code and then examined what reviews produced. Finding defects was the stated main motive. The actual main outcomes included knowledge transfer, awareness of changes, and shared ownership; defect comments were a minority and mostly about minor issues. Review is one of the few routine mechanisms through which understanding spreads.

**What documentation can do.**

| Worth writing | Because |
|---|---|
| Decisions with context, rejected alternatives, and consequences (ADRs, §15) | Relational knowledge; cheap now, costly to reconstruct |
| Invariants and the reasons for them | Violations are otherwise found in production |
| Maps: what exists, where, who owns it | Orientation; a way to find the people |
| Operating procedures that are in fact explicit (§13) | Needed at 03:00 by someone under stress |
| Worked examples and boundary cases (§17) | Constrain interpretation better than prose |
| Known traps | Each costs someone a day otherwise |

| Not achievable by writing | Because |
|---|---|
| The ability to extend the design consistently | It is a capacity (§16e) |
| Judgment about what matters in this domain | Collective tacit knowledge |
| Current truth, unless maintained beside the code | Documents decay at the rate the system changes |

Tests and types are the forms of written knowledge that do not decay silently, because the machine checks them on every change (§9, §15). Parnas & Clements (1986) made a related point about design documentation: write it as if the design had been reached by a rational process, because that is the form most useful to later readers, while knowing the real process was not like that.

**What transfers the rest.**
- Working on real changes together: pairing, group work, review as conversation.
- Apprenticeship at the edge of real work, with feedback.
- Rotation across components before it is urgent.
- Overlap at handover: weeks or months of joint work by outgoing and incoming people.
- Stories: incident reviews (§13), design histories told in person.
- Stable, long-lived teams, which is the cheapest method, because it avoids the transfer.

**Organizations forget.** Studies of production learning curves found that knowledge gained through experience depreciates quickly when production is interrupted or people leave (Argote & Epple 1990). An organization's competence is a flow that must be maintained, not an asset that stays where it was put.

**The pull toward legibility.** Auditors, funders, and contracting authorities can inspect documents and certificates. They cannot inspect understanding. Institutions therefore reward the production of explicit artifacts and treat continuity of people as an operational detail (§20–§22). Scott (1998) calls local, practical, experience-based knowledge *mētis*, and documents a long record of formal schemes that failed because they overrode it. The systematic result in software is over-investment in documents and under-investment in keeping the people who know.

**Language models and tacit knowledge.** *Tentative.* Dreyfus predicted that systems without bodies and social lives could not acquire the background that human expertise rests on. Language models have absorbed a great deal of the regularity in written human practice, including much that people do without being able to state rules for it, and they did so without anyone formalizing it. That weakens the strongest form of the prediction. Collins (2018) maintains that collective tacit knowledge still requires participation in a society. For software work the narrower point is safer: a model has the general practice of programming and lacks the particular theory of this system and this organization, which was never written anywhere. The METR study's participants reported exactly this gap (§16, note).

### Trade-offs and alternatives

| Approach | Gains | Costs |
|---|---|---|
| **Stable long-lived teams** | No transfer needed; deep theory; transactive memory intact | Inflexible staffing; risk of insularity; conflicts with project-based funding and re-tendering |
| **Redundancy of understanding** (two or more people per area; rotation) | Survives departures | Apparent inefficiency; slower in the short run |
| **Documentation of decisions, invariants, traps** | Cheap; durable; serves newcomers and auditors | Covers relational knowledge only; needs upkeep |
| **Comprehensive documentation** | Legible; contractible | Expensive; decays; creates false assurance |
| **Executable knowledge** (tests, types, automation) | Cannot silently go stale | Captures what, rarely why |
| **Handover with overlap** | Transfers capacity | Double cost for the overlap period; requires the outgoing party's cooperation |
| **In-house core team plus external capacity** | Retains theory and absorptive capacity; scales with suppliers | Hard to hire and keep; needs governance of the mixed team |
| **Full outsourcing** | Flexible; no hiring | Theory sits with the supplier; lock-in or loss at every change (§21, §22) |

### Contested points

- **Is tacit knowledge unsayable or merely unsaid?** The knowledge-management tradition treats it as content not yet written. Collins and Tsoukas treat much of it as a different kind of thing. The taxonomy above reconciles them: some is unsaid, some is unsayable, and practice goes wrong by treating the second as the first.
- **The SECI model.** Influential in management, weakly supported, and conceptually disputed. See above.
- **Naur's claim that a dead program cannot be revived.** Teams do take over systems successfully. The fair reading is that they build a new theory at a cost comparable to a large part of the original, and that the cost is routinely left out of plans.
- **Documentation in agile development.** The Agile Manifesto's preference for working software over comprehensive documentation is read by some as licence to write nothing. Its authors have said that was not the intent. The evidence on how much documentation helps maintainers is mixed and depends on what is documented.
- **Bus-factor metrics.** Computed from commit authorship, which measures who typed and not who understands. Useful as a warning signal, unreliable as a measure.
- **Dreyfus and artificial intelligence.** His critique was vindicated against rule-based systems and is challenged by learning systems. Whether current models have anything deserving the name of tacit knowledge is disputed among philosophers and of limited practical importance here.

### Examples

**Example 18.1 — Three designs for a supplier transition.** A registry system changes maintenance supplier after four years.

| Design | What transfers | Typical result |
|---|---|---|
| **A. Contractual handover:** documentation updated, two workshops, code repository transferred | Explicit knowledge; some relational tacit knowledge | Six to twelve months of low throughput and elevated defect rate; "rewrite" proposals within a year |
| **B. Overlap:** three months in which outgoing and incoming developers work in mixed pairs on real changes, paid for in both contracts | Much relational knowledge; the beginnings of a theory | Shorter dip; depends on the outgoing supplier's goodwill, which the tender must purchase explicitly |
| **C. Client-held core:** two or three client-employed engineers work in the team throughout and stay through the transition | The theory, held by the client | Small dip; the client can also evaluate both suppliers. Requires the client to employ and retain such people |

A is what procurement produces by default. C is what the literature in this set recommends. The difference in cost is visible in the budget; the difference in outcome is not, which is why A persists (§20, §21).

**Example 18.2 — What a decision record carries.**

```markdown
# ADR-023: Reminders are driven by a claimed-batch table, not by a scheduler per obligation

Context:  ~6,000 obligations become due on the same date. Earlier design (one timer per
          obligation) produced a thundering herd and duplicate sends after pod restarts.
Decision: A single table of pending reminders, claimed in batches with FOR UPDATE SKIP LOCKED;
          sends are idempotent by (obligation_id, reminder_no).
Rejected: (a) Quartz cluster — second source of truth for schedule state;
          (b) message broker with delayed delivery — not available in the hosting environment.
Invariant: at most one reminder per (obligation_id, reminder_no). Enforced by a unique index.
Consequences: reminder latency up to one polling interval; sweeper needed for expired claims.
```

This is relational tacit knowledge made explicit: twenty lines that save a successor a week and prevent the reintroduction of option (a). It does not give the successor the ability to decide well when the next requirement arrives, for instance reminders by SMS with per-recipient quiet hours. That comes from having worked in the design.

### Key literature

1. **Polanyi, M. (1966). *The Tacit Dimension*. Doubleday.** — *Seminal.* The structure of tacit knowing.
2. **Ryle, G. (1949). *The Concept of Mind*. Hutchinson.** — *Seminal.* Knowing how versus knowing that, and the regress argument against reducing the first to the second.
3. **Naur, P. (1985). "Programming as Theory Building."** (Cited in §16.) — *Seminal.* The application of Ryle to software, and its consequences for program life cycles.
4. **Collins, H. (2010). *Tacit and Explicit Knowledge*. University of Chicago Press.** — *Recent.* The relational/somatic/collective taxonomy. For the laser study: **Collins, H. M. (1974). "The TEA Set: Tacit Knowledge and Scientific Networks." *Science Studies* 4(2).**
5. **Lave, J. & Wenger, E. (1991). *Situated Learning: Legitimate Peripheral Participation*. Cambridge University Press.** — *Seminal.* Learning as becoming a participant in a practice. With **Brown, J. S. & Duguid, P. (1991). "Organizational Learning and Communities-of-Practice." *Organization Science* 2(1)** and **Orr, J. E. (1996). *Talking about Machines*. Cornell University Press.**
6. **Cohen, W. M. & Levinthal, D. A. (1990). "Absorptive Capacity: A New Perspective on Learning and Innovation." *Administrative Science Quarterly* 35(1).** — *Seminal.* Why an organization must do some of the work to be able to buy the rest. With **Szulanski, G. (1996). "Exploring Internal Stickiness." *Strategic Management Journal* 17(S2).**
7. **Bacchelli, A. & Bird, C. (2013). "Expectations, Outcomes, and Challenges of Modern Code Review." ICSE '13.** — *Recent empirical.* What code review actually delivers.
8. **Rigby, P. C., Zhu, Y. C., Donadelli, S. M. & Mockus, A. (2016). "Quantifying and Mitigating Turnover-Induced Knowledge Loss." ICSE '16.** — *Recent empirical.* Measuring what leaves with people.

Also: **Gourlay, S. (2006). "Conceptualizing Knowledge Creation: A Critique of Nonaka's Theory." *Journal of Management Studies* 43(7).** **Tsoukas, H. (2003). "Do We Really Understand Tacit Knowledge?" In *The Blackwell Handbook of Organizational Learning and Knowledge Management*.** **Scott, J. C. (1998). *Seeing Like a State*. Yale University Press.** **Parnas, D. L. & Clements, P. C. (1986). "A Rational Design Process: How and Why to Fake It." *IEEE Transactions on Software Engineering* SE-12(2).**

### Self-check questions

1. Classify five things your team knows as relational, somatic, or collective tacit knowledge. Which of them are documented, and which of the documented ones are of a kind that documentation can carry?
2. A handover plan allots two weeks of workshops and a documentation update. Using Collins's laser study and Szulanski's findings, predict the result and propose a change within the same budget.
3. Why does an organization that outsources all development lose the ability to write a good tender for development? Name the concept and the mechanism.
4. What did Bacchelli and Bird find that code review delivers? How should that change what you ask of reviewers and how you measure review?
5. An auditor asks for evidence that knowledge about a critical system is safeguarded. What can you show, and how well does it correspond to what actually safeguards it?

---

## Closing Part III: what replaces the lost hope

The position this part examined holds that the hope of resolving a software project by a clear specification has gone. After sets 16–18, that position can be stated in a form that is defensible and useful.

**What is established.**
1. Stating a thought in language is a translation for a listener, not a readout (§16b).
2. A reader constructs meaning from a text using their own prior knowledge. Readers with different priors construct different meanings and do not notice (§16c).
3. No text determines its own application. The regress of interpretation ends in shared practice and feedback (§17).
4. Requirements concern an informal world. The link from that world to any formal description is made and checked by human judgment (§17).
5. Understanding of a system is a capacity of particular people and groups. It is grown, not copied (§16e, §18).

**What does not follow.**
- That specifications are useless. They are records of decisions, boundary objects that coordinate groups with different understandings, hypotheses to test, and the necessary basis of contracts.
- That formalization fails. It succeeds inside the machine and at the core of rule-heavy domains, and its by-product, the forced discovery of contradictions and undecided cases, may be its main value.
- That the variation between readers is irreducible. It shrinks with shared context, concrete examples, and fast feedback.
- That any of this is new. The arguments are old. The evidence and the practical test are new.

**What takes the place of the conduit model.**

| Instead of | Work with |
|---|---|
| Capturing requirements | Constructing them through attempts, with the people who do the work |
| A specification that contains the meaning | A specification as a boundary object, a decision record, and a set of hypotheses |
| Review for agreement | Derivation of consequences: examples, boundary cases, tests, working software |
| More detail to remove ambiguity | Examples and feedback to expose it; authority to decide it |
| Formal precision everywhere | Formal precision where invariants and rules justify it, with explicit domain assumptions |
| Handover documents | Continuity and overlap of people; documents for decisions, invariants, and traps |
| Fluency as a sign of understanding | Ability to explain, predict, and extend as the sign |

**Why the old model persists.** Not for lack of refutation. It persists because contracts, budgets, audits, and procurement procedures need commitments that are written, fixed in advance, and checkable by people who do not understand the work. Those needs are legitimate. Part IV examines them and asks which of them can be met in ways that do not depend on the conduit model being true.

---

> **End of installment 3.** This installment covers Part III (sets 16–18). Installment 4 covers **Part IV, sets 19–23**: organization, governance, economics, law and procurement, and software in society.
