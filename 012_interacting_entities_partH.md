# 012 — Interacting Entities: State, Invariants, Coordination and Time

## Part H — References

References are grouped by field. Within a group they are in the order in which the article uses them.

### How to read the markers

| Marker | Meaning |
|---|---|
| **✓** | Bibliographic details checked against an online source while this article was written (November 2026) |
| *(no marker)* | Cited from the author's knowledge. The work exists; year and venue are given in good faith and should be confirmed before formal citation |
| **?** | A specific detail is uncertain; the uncertainty is stated |

No reference is included that the author is not confident exists. For tools and products, a separate list follows, with the instruction that applies to all of them: **verify against the current version**.

---

## H.1 Automata, statecharts and state

- Mealy, G. H. (1955). A method for synthesizing sequential circuits. *Bell System Technical Journal* 34(5).
- Moore, E. F. (1956). Gedanken-experiments on sequential machines. In *Automata Studies*, Princeton University Press.
- Nerode, A. (1958). Linear automaton transformations. *Proceedings of the American Mathematical Society* 9.
- Harel, D. (1987). Statecharts: a visual formalism for complex systems. *Science of Computer Programming* 8(3).
- von der Beeck, M. (1994). A comparison of statecharts variants. In *Formal Techniques in Real-Time and Fault-Tolerant Systems*, LNCS 863.
- Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1994). *Design Patterns*. Addison-Wesley. (The State pattern.)
- Object Management Group. *Unified Modeling Language*, version 2.5.1 (2017). (State machines; completion transitions.)
- W3C (2015). *State Chart XML (SCXML): State Machine Notation for Control Abstraction*. Recommendation.

## H.2 Safety, liveness and timed systems

- Lamport, L. (1977). Proving the correctness of multiprocess programs. *IEEE Transactions on Software Engineering* SE-3(2).
- Alpern, B., Schneider, F. B. (1985). Defining liveness. *Information Processing Letters* 21(4).
- Alur, R., Dill, D. L. (1994). A theory of timed automata. *Theoretical Computer Science* 126(2).
- **✓** Henzinger, T. A., Kopke, P. W., Puri, A., Varaiya, P. (1998). What's decidable about hybrid automata? *Journal of Computer and System Sciences* 57(1), 94–124. Conference version: STOC 1995. (Reachability is undecidable for timed automata with a single stopwatch.)

## H.3 Transactions, concurrency control and consistency

- Eswaran, K. P., Gray, J. N., Lorie, R. A., Traiger, I. L. (1976). The notions of consistency and predicate locks in a database system. *Communications of the ACM* 19(11).
- Gray, J. (1978). Notes on data base operating systems. In *Operating Systems: An Advanced Course*, LNCS 60. (Two-phase commit.)
- Gray, J. (1981). The transaction concept: virtues and limitations. *Proceedings of VLDB*.
- Kung, H. T., Robinson, J. T. (1981). On optimistic methods for concurrency control. *ACM Transactions on Database Systems* 6(2).
- Härder, T., Reuter, A. (1983). Principles of transaction-oriented database recovery. *ACM Computing Surveys* 15(4). (The ACID acronym.)
- O'Neil, P. E. (1986). The escrow transactional method. *ACM Transactions on Database Systems* 11(4).
- Garcia-Molina, H., Salem, K. (1987). Sagas. *Proceedings of ACM SIGMOD*.
- Gray, C., Cheriton, D. (1989). Leases: an efficient fault-tolerant mechanism for distributed file cache consistency. *Proceedings of SOSP*.
- Herlihy, M. P., Wing, J. M. (1990). Linearizability: a correctness condition for concurrent objects. *ACM Transactions on Programming Languages and Systems* 12(3).
- Gray, J., Reuter, A. (1993). *Transaction Processing: Concepts and Techniques*. Morgan Kaufmann. (The lock manager.)
- Berenson, H., Bernstein, P., Gray, J., Melton, J., O'Neil, E., O'Neil, P. (1995). A critique of ANSI SQL isolation levels. *Proceedings of ACM SIGMOD*. (Snapshot isolation; write skew.)
- Bishop, M., Dilger, M. (1996). Checking for race conditions in file accesses. *Computing Systems* 9(2). (Time-of-check to time-of-use.)
- Cahill, M. J., Röhm, U., Fekete, A. D. (2008). Serializable isolation for snapshot databases. *Proceedings of ACM SIGMOD*.
- Dijkstra, E. W. (1965). *Cooperating sequential processes*. EWD 123. (Semaphores.)

## H.4 Distributed systems and coordination

- Brewer, E. (2000). Towards robust distributed systems. Keynote, PODC.
- Gilbert, S., Lynch, N. (2002). Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services. *ACM SIGACT News* 33(2).
- Saito, Y., Shapiro, M. (2005). Optimistic replication. *ACM Computing Surveys* 37(1).
- Helland, P. (2007). Life beyond distributed transactions: an apostate's opinion. *Proceedings of CIDR*.
- Helland, P. (2007). Memories, guesses, and apologies. Blog post. **?** The exact date and current location of the post should be confirmed.
- Helland, P., Campbell, D. (2009). Building on quicksand. *Proceedings of CIDR*.
- Bailis, P., Fekete, A., Franklin, M. J., Ghodsi, A., Hellerstein, J. M., Stoica, I. (2014). Coordination avoidance in database systems. *Proceedings of the VLDB Endowment* 8(3). (Invariant confluence.)
- Hellerstein, J. M., Alvaro, P. (2020). Keeping CALM: when distributed consistency is easy. *Communications of the ACM* 63(9).
- Herlihy's consensus hierarchy, the impossibility of exactly-once, and fencing are treated with their sources in article 008.

## H.5 Actors

- Hewitt, C., Bishop, P., Steiger, R. (1973). A universal modular ACTOR formalism for artificial intelligence. *Proceedings of IJCAI*.
- Agha, G. (1986). *Actors: A Model of Concurrent Computation in Distributed Systems*. MIT Press.
- Bernstein, P. A., Bykov, S., Geller, A., Kliot, G., Thelin, J. (2014). *Orleans: Distributed Virtual Actors for Programmability and Scalability*. Microsoft Research technical report MSR-TR-2014-41.

## H.6 Domain-driven design, aggregates and event sourcing

- Evans, E. (2003). *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley.
- **✓** Vernon, V. (2011). Effective aggregate design, Parts I–III. Published by the DDD community (dddcommunity.org).
- **✓** Vernon, V. (2013). *Implementing Domain-Driven Design*. Addison-Wesley. Chapter 10, "Aggregates", section "Reasons to Break the Rules".
- **✓** Dahan, U. (2010). Race conditions don't exist. Blog post, 31 August 2010.
- Young, G. (2017). *Versioning in an Event Sourced System*. Leanpub.
- **✓** Chassaing, J. (2021). Functional event sourcing Decider. Blog post, thinkbeforecoding.com, 17 December 2021.
- Richardson, C. (2018). *Microservices Patterns*. Manning. (Orchestrated and choreographed sagas; countermeasures for the lack of isolation; the pivot transaction.)
- Brandolini, A. *Introducing EventStorming*. Leanpub. (The term "policy" for a reaction rule.)
- **✓** Pellegrini, S. Killing the aggregate. Blog post. **?** Year to be confirmed; sources give 2023 for the talk and 2024 for the concept's introduction.
- **✓** *Dynamic Consistency Boundary* specification. dcb.events. Licensed CC BY-SA 4.0.

## H.7 Messaging, process and workflow

- Petri, C. A. (1962). *Kommunikation mit Automaten*. Dissertation, University of Bonn.
- Hollingsworth, D. (1995). *The Workflow Reference Model*. Workflow Management Coalition, TC00-1003.
- van der Aalst, W. M. P. (1997). Verification of workflow nets. In *Application and Theory of Petri Nets*, LNCS 1248. (Soundness; its equivalence to liveness and boundedness of the short-circuited net. This is the source for the two statements in A.7 that were left without one.)
- van der Aalst, W. M. P. (1998). The application of Petri nets to workflow management. *Journal of Circuits, Systems and Computers* 8(1).
- Hohpe, G., Woolf, B. (2003). *Enterprise Integration Patterns*. Addison-Wesley. (Aggregator; Process Manager; publish-subscribe.)
- van der Aalst, W. M. P., ter Hofstede, A. H. M., Kiepuszewski, B., Barros, A. P. (2003). Workflow patterns. *Distributed and Parallel Databases* 14(1).
- Peltz, C. (2003). Web services orchestration and choreography. *IEEE Computer* 36(10).
- van der Aalst, W. M. P., ter Hofstede, A. H. M. (2005). YAWL: yet another workflow language. *Information Systems* 30(4).
- **✓** Dijkman, R. M., Dumas, M., Ouyang, C. (2008). Semantics and analysis of business process models in BPMN. *Information and Software Technology* 50(12), 1281–1294.
- Jensen, K., Kristensen, L. M. (2009). *Coloured Petri Nets: Modelling and Validation of Concurrent Systems*. Springer.
- **✓** Pardon, G. (2009). *Try-Cancel/Confirm: Transactions for (Web) Services*. Atomikos.
- **✓** Pardon, G., Pautasso, C. (2014). Atomic distributed transactions: a RESTful design. *5th International Workshop on Web APIs and RESTful Design*, ACM.
- Object Management Group (2011). *Business Process Model and Notation (BPMN)*, version 2.0.
- Object Management Group. *Decision Model and Notation (DMN)*. (Hit policies.)

## H.8 Access control and policy

- Bradner, S. (1997). *Key words for use in RFCs to Indicate Requirement Levels*. RFC 2119.
- Yavatkar, R., Pendarakis, D., Guerin, R. (2000). *A Framework for Policy-based Admission Control*. RFC 2753. (PEP and PDP.)
- OASIS (2013). *eXtensible Access Control Markup Language (XACML) Version 3.0*. (Combining algorithms; obligations and advice.)
- Hu, V. C., et al. (2014). *Guide to Attribute Based Access Control (ABAC) Definition and Considerations*. NIST Special Publication 800-162.

## H.9 Feature interaction

- Bowen, T. F., Dworack, F. S., Chow, C. H., Griffeth, N., Herman, G. E., Lin, Y.-J. (1989). The feature interaction problem in telecommunications systems. *Software Engineering for Telecommunication Switching Systems*.
- Zave, P. (1993). Feature interactions and formal specifications in telecommunications. *IEEE Computer* 26(8).
- Calder, M., Kolberg, M., Magill, E. H., Reiff-Marganiec, S. (2003). Feature interaction: a critical review and considered forecast. *Computer Networks* 41(1).

## H.10 Requirements, data modelling and logic

- Russell, B. (1905). On denoting. *Mind* 14(56).
- Codd, E. F. (1970). A relational model of data for large shared data banks. *Communications of the ACM* 13(6).
- Codd, E. F. (1971). Further normalization of the data base relational model. IBM Research Report RJ909.
- Jackson, M. (1995). The world and the machine. *Proceedings of ICSE*.
- Zave, P., Jackson, M. (1997). Four dark corners of requirements engineering. *ACM Transactions on Software Engineering and Methodology* 6(1).

## H.11 Complexity, judgement and decision

- Brooks, F. P. (1986). No silver bullet: essence and accident in software engineering. *Proceedings of the IFIP Tenth World Computing Conference*. Reprinted in *IEEE Computer* 20(4), 1987.
- Howard, R. A. (1966). Information value theory. *IEEE Transactions on Systems Science and Cybernetics* SSC-2(1).
- Beck, K. (1999). *Extreme Programming Explained*. Addison-Wesley. (YAGNI.)
- **✓** Bezos, J. (2016). Letter to shareholders for 2015. Amazon.com. (Type 1 and Type 2 decisions; one-way and two-way doors.)
- Sato, D. (2014). ParallelChange. martinfowler.com.

## H.12 Formal verification and testing

- Lamport, L. (1994). The temporal logic of actions. *ACM Transactions on Programming Languages and Systems* 16(3).
- Lamport, L. (2002). *Specifying Systems*. Addison-Wesley.
- Lamport, L. (2005). Real-time model checking is really simple. *CHARME*, LNCS 3725.
- Larsen, K. G., Pettersson, P., Yi, W. (1997). UPPAAL in a nutshell. *International Journal on Software Tools for Technology Transfer* 1(1–2).
- Claessen, K., Hughes, J. (2000). QuickCheck: a lightweight tool for random testing of Haskell programs. *Proceedings of ICFP*.
- Jackson, D. (2006). *Software Abstractions: Logic, Language, and Analysis*. MIT Press. (Alloy; the small-scope hypothesis.)
- Musuvathi, M., Qadeer, S., Ball, T., Basler, G., Nainar, P. A., Neamtiu, I. (2008). Finding and reproducing Heisenbugs in concurrent programs. *Proceedings of OSDI*. (CHESS.)
- Desai, A., Gupta, V., Jackson, E., Qadeer, S., Rajamani, S., Zufferey, D. (2013). P: safe asynchronous event-driven programming. *Proceedings of PLDI*.
- Newcombe, C., Rath, T., Zhang, F., Munteanu, B., Brooker, M., Deardeuff, M. (2015). How Amazon Web Services uses formal methods. *Communications of the ACM* 58(4).
- Hughes, J. (2016). Experiences with QuickCheck: testing the hard stuff and staying sane. In *A List of Successes That Can Change the World*, LNCS 9600.
- **✓** Deligiannis, P., Senthilnathan, A., Nayyar, F., Lovett, C., Lal, A. (2023). Industrial-strength controlled concurrency testing for C# programs with Coyote. *TACAS 2023*, LNCS 13994, 433–452.

---

## H.13 Tools and products

**Verify every entry against the current version, documentation and licence.** The second column records what was done for this article.

| Tool | Checked for this article (November 2026) | Used in |
|---|---|---|
| PostgreSQL isolation levels | Not checked; from the author's knowledge | A.4 |
| Marten | DCB documentation and implementation notes read. Multi-stream commit in one transaction: from the author's knowledge | D2.2, D2.3 |
| KurrentDB | Multi-stream atomic append from 25.1: release notes and .NET client documentation read | D2.2 |
| Cratis Chronicle | Documentation read; it states it is not a DCB event store | D2.2, D2.3 |
| Axon Framework 5 / Axon Server | Vendor pages read | D2.3 |
| Sekiban | Repository and package pages read; DCB packages seen with preview versions | D2.3 |
| eventsourcing (Python) | Documentation read; DCB from 9.5 | D2.3 |
| Orleans | Request-scheduling documentation read | D2.4 |
| Open Policy Agent; Cedar | Not checked | D1.4 |
| XState; Stately Studio | Not checked | D1.2, E.5 |
| Camunda; Elsa Workflows; Temporal; Azure Durable Functions; Dapr Workflow | Not checked | D3.3 |
| TLA+ / TLC | Not checked beyond the TLA+ documentation wiki | E.1 |
| Quint; Apalache | Documentation read | E.1 |
| P; Alloy; UPPAAL | Not checked | E.1 |
| CsCheck | Could not be read; feature names from the author's knowledge | E.3 |
| Coyote | Package registry read: latest 1.7.11, 18 March 2024, targeting .NET 6.0 and .NET Standard 2.0. Repository page could not be read | E.4 |
| Spectacle | Project description and TLA+ wiki read | E.5 |
| prooph board; Context Mapper | Not checked | E.5 |

---

## H.14 Corrections made during verification

A stated limit is an engineering artifact. So is a stated correction.

| Where | Original | Corrected |
|---|---|---|
| C.2 | The reasons to break the one-aggregate rule were attributed to Vernon's 2011 articles | They are in his 2013 book, chapter 10, which lists four. The Part C file has been amended |
| A.7 | Decidability of soundness, and the abstraction from data and time, were tagged as theory without a named source | van der Aalst (1997), listed in H.7 |
| D2.3 | An earlier working note described Cratis Chronicle as mapping to DCB | Its documentation says it is not a DCB event store; D2.3 records this |

## H.15 Cross-references within the series

| Article | Used here for |
|---|---|
| 006 | Temporal coupling; the transactional outbox; at-least-once delivery |
| 008 | Timers that fire late, twice or never; leases and fencing; the consensus hierarchy and why read-then-act is not a coordination primitive; safety and liveness; the guarantee statement |
| 009 | Mechanism versus authority; PEP and PDP; the invariant register; architecture decision records |

## H.16 The installments

| File | Part |
|---|---|
| `012_interacting_entities_part0.md` | Opening, Preface, case brief |
| `012_interacting_entities_partA.md` | The essence, and its relation to business |
| `012_interacting_entities_partB1.md` | Catalogue: modelling defects |
| `012_interacting_entities_partB2.md` | Catalogue: interaction defects |
| `012_interacting_entities_partC.md` | Over-analysing versus over-engineering; selection parameters |
| `012_interacting_entities_partD1.md` | Alternatives: structure inside an entity |
| `012_interacting_entities_partD2.md` | Alternatives: the consistency boundary |
| `012_interacting_entities_partD3.md` | Alternatives: process coordination |
| `012_interacting_entities_partD4.md` | Evolution |
| `012_interacting_entities_partE.md` | Modelling and validation |
| `012_interacting_entities_partF.md` | Checklists |
| `012_interacting_entities_partG.md` | The worked example, consolidated |
| `012_interacting_entities_partH.md` | References |
