# Lec23 - File System 4: Transactions and Distributed Decision Making

## Learning Objectives
After this note, you should be able to explain why file systems need transaction-like recovery, how careful ordering differs from copy-on-write, how journaling turns multi-block updates into durable all-or-nothing operations, and how distributed systems use protocols to coordinate decisions across machines. You should also be able to describe the Two General's Paradox, the Two-Phase Commit protocol, its state machines, its recovery rules, and its blocking limitation.

## 1. Two Reliability Approaches
There are two broad approaches to file-system reliability.

![Two reliability approaches](./lec23_materials/two_reliability_approaches.png)

| Approach | Examples | Core idea | Recovery behavior |
|---|---|---|---|
| Careful ordering and recovery | FAT and FFS with `fsck` | Each step builds structure in an order such as data block, inode, free map, and directory. The last step links the new structure into the rest of the file system. | Recovery scans structures looking for incomplete actions. |
| Versioning and copy-on-write | ZFS and similar systems | Version files at some granularity. Create a new structure that links back to unchanged parts of the old one. The last step declares the new version ready. | Recovery keeps the last complete version and ignores incomplete new structures. |

The common goal is to survive a crash in the middle of a sequence. The system must avoid exposing a half-built persistent structure as if it were complete.

## 2. Careful Ordering
Careful ordering means sequencing operations in a specific order so that the sequence can be interrupted safely. After a crash, recovery reads file-system data structures, checks whether any operation was in progress, and cleans up or finishes the operation as needed.

This approach is used by FAT and FFS with `fsck` to protect file-system metadata. Similar ideas also appear in application-level recovery schemes, such as temporary autosave files in editors.

The core question is:

**Assume you need to store a piece of data and a directory entry or pointer for the data. Assume each operation is atomic. Which one should you write first: data or pointer?**

:::remark Question: Should the file system write data first or pointer first?
The safer careful-ordering rule is to write the data first and write the pointer last. If a crash happens after the data is written but before the pointer is written, the system may have an unreachable fragment, which recovery can delete or place in `lost+found`. If the pointer is written first and the crash happens before the data is written, the file system may expose a directory entry or inode pointer to uninitialized or stale data. That is more dangerous because the namespace now points to invalid content.
:::

## 3. Berkeley FFS: Creating a File
Creating a file in Berkeley FFS illustrates why careful ordering and recovery are needed.

![Berkeley FFS create file and recovery](./lec23_materials/ffs_create_file_recovery.png)

The normal operation includes:

1. Allocate data block.
2. Write data block.
3. Allocate inode.
4. Write inode block.
5. Update bitmap of free blocks and inodes.
6. Update directory with file name -> inode number.
7. Update modify time for directory.

Recovery includes:

1. Scan inode table.
2. If any unlinked files are not in any directory, delete them or put them in `lost+found`.
3. Compare free block bitmap against inode trees.
4. Scan directories for missing update/access times.

The recovery cost is proportional to disk size. That is the major weakness: a full scan may be slow when the disk is large.

:::remark Question: Why is `fsck` recovery proportional to disk size?
`fsck` must inspect global file-system structures rather than just the operation that was interrupted. It scans inode tables, directory structures, and free-space metadata to reconstruct consistency. The larger the disk and metadata space, the longer the scan.
:::

## 4. Copy-on-Write File Layout
Copy-on-write avoids overwriting existing data blocks and updating pointers in place. Instead, the system creates a new version of the file with updated data and reuses unchanged blocks from the old version.

The key idea is **Copy On Write (COW)**: do not modify the old structure directly. Write new blocks, build new pointers, and publish the new version at the end.

![Copy-on-write with smaller-radix blocks](./lec23_materials/cow_smaller_radix_blocks.png)

If a file is represented as a tree of blocks, an update only needs to rewrite the leading fringe: the changed leaf block and the chain of pointer blocks from that leaf to the root. Unchanged subtrees can be shared between the old version and the new version.

COW seems expensive, but it has two important mitigating factors:

- updates can be batched;
- almost all disk writes can occur in parallel.

This approach appears in network file-server appliances and modern file systems such as NetApp's Write Anywhere File Layout (WAFL), ZFS, and OpenZFS.

:::remark Question: Why does COW make recovery simpler?
The old version remains intact until the new version is completely built and published. If a crash happens before the final pointer update, recovery can keep using the old version. If the final pointer update happens, the new version is complete. There is no need to repair a partially overwritten old structure.
:::

## 5. ZFS and OpenZFS
ZFS and OpenZFS use COW-style ideas with several practical design choices:

- Variable sized blocks: 512 B to 128 KB.
- Symmetric tree: the system knows whether a block is large or small when it makes the copy.
- Version number stored with pointers: new versions can be created by adding blocks and new pointers.
- A collection of writes can be buffered before a new version is created.
- Free space is represented as a tree of extents in each block group.
- Free-space updates can be delayed in a log and applied together when the block group is activated.

The result is a file-system layout that can support versions, reliable recovery, and high sequential write performance.

## 6. Transactions as a General Reliability Solution
Careful ordering and COW are important, but the more general reliability idea is transactions.

Transactions provide atomic updates:

- multiple related updates are performed atomically;
- if a crash occurs in the middle, the system reflects either all updates or none of them;
- modern file systems often use transactions internally to update file-system structures and metadata;
- many applications implement their own transactions.

Redundancy is a separate requirement for media failures:

- redundant representation on media, such as error-correcting codes;
- replication across media, such as RAID disk arrays.

Transactions protect consistency of updates. Redundancy protects against physical data loss. Both matter, but they solve different problems.

## 7. Key Concept: Transaction
The key definition is:

**A transaction is an atomic sequence of reads and writes that takes the system from consistent state to another.**

A transaction is closely related to a critical section. Code inside a critical section appears atomic to other threads while it manipulates shared memory. Transactions extend atomic update from memory to stable storage, where updates must survive crashes.

The typical structure is:

1. Begin a transaction and get a transaction id.
2. Perform a group of updates.
3. Roll back if any update fails or if there is a conflict with another transaction.
4. Commit the transaction if the whole group succeeds.

:::remark Question: Why is a transaction stronger than just doing several writes in sequence?
Several writes in sequence can leave a partial state if the system crashes between them. A transaction gives the group a single logical outcome: either the whole group becomes visible and durable, or none of it does.
:::

## 8. Classic Transaction Example: Bank Transfer
The classic example transfers `$100` from Alice's account to Bob's account.

![Bank transfer transaction](./lec23_materials/transaction_bank_transfer.png)

The transaction begins, subtracts `$100` from Alice's account, subtracts `$100` from Alice's branch balance, adds `$100` to Bob's account, adds `$100` to Bob's branch balance, and then commits.

```sql
BEGIN;     -- BEGIN TRANSACTION

UPDATE accounts
SET balance = balance - 100.00
WHERE name = 'Alice';

UPDATE branches
SET balance = balance - 100.00
WHERE name = (
  SELECT branch_name FROM accounts WHERE name = 'Alice'
);

UPDATE accounts
SET balance = balance + 100.00
WHERE name = 'Bob';

UPDATE branches
SET balance = balance + 100.00
WHERE name = (
  SELECT branch_name FROM accounts WHERE name = 'Bob'
);

COMMIT;    -- COMMIT WORK
```

The example is not about bank software specifically. It shows why multiple persistent updates must be one logical unit. If the system crashes after Alice is debited but before Bob is credited, the persistent state is wrong.

:::remark Question: What should happen if the transfer crashes halfway through?
The transaction system should either roll back all changes so Alice still has the money, or commit all changes so Bob receives it and the branch balances match. A state where Alice lost money but Bob did not receive it is not a consistent state.
:::

## 9. Concept of a Log
A log uses one simple atomic action: write or append a basic item. That atomic append can seal commitment to a whole series of actions.

![Concept of a log](./lec23_materials/log_concept.png)

A transaction log records a start marker, the intended actions, and a commit marker. The illustrated transaction records actions such as getting money from accounts A, B, and C, putting money into accounts X and Y, and then writing `Commit Tran N`.

The important rule is: commit is not a feeling; commit is a durable record. Once the commit record is safely in the log, the system can replay the transaction after a crash.

## 10. Transactional File Systems
Transactional file systems improve reliability through a log:

- changes are treated as transactions;
- a transaction is committed once it is written to the log;
- data is forced to disk for reliability;
- NVRAM can accelerate the process;
- even if the file system is not updated immediately, the data is preserved in the log.

There is an important distinction:

- In a log-structured file system, data stays in log form.
- In a journaled file system, the log is used for recovery.

## 11. Journaling File Systems
Journaling file systems do not modify on-disk data structures directly. Instead, they write each update as a transaction recorded in a log. This log is commonly called a journal or intention list, and it is also maintained on disk.

Once changes are in the log, they can be safely applied to the file system. For example, the system can modify inode pointers and directory mappings. After a change has been applied, garbage collection removes its entry from the log.

Linux ext3 was created by adding a journal to the original FFS-like ext2 file system. Other examples include NTFS, Apple HFS+, Linux XFS, JFS, and ext4.

Modern systems may choose whether to journal all data or only metadata. Metadata journaling records modifications to file-system structures, while file contents can be written directly.

:::remark Question: Why do many modern file systems journal only metadata?
Journaling all data writes everything twice: once to the log and once to the final location. Metadata is the part most likely to break file-system consistency if interrupted, so journaling metadata gives strong structural recovery with much lower write overhead.
:::

## 12. Creating a File With Journaling
Without journaling, creating a file searches for free data blocks, a free inode entry, and a directory-entry insertion point, then writes the map, inode entry, and directory entry directly.

With journaling, the update is first placed into a non-volatile log.

![Creating a file with journaling](./lec23_materials/journaling_create_file.png)

The logged transaction contains:

1. `[log] Write map`, marking the data block used.
2. `[log] Write inode entry` so it points to the block.
3. `[log] Write dirent` so the directory points to the inode.
4. A start marker and a commit marker in the log.

The log has a `done` region and a `pending` region. The `tail` points to older log records, and the `head` advances as new records are appended. The transaction is safe to apply only after the commit marker is durable.

## 13. Replay After Commit
After commit, the file system may not immediately update the final on-disk structures.

![Replay committed transaction](./lec23_materials/journaling_replay_committed.png)

All accesses to the file system first look in the log, because the actual on-disk data structure might be stale. Eventually, the system copies the logged changes to their final disk locations and discards the transaction from the log.

This is why the log takes precedence over the ordinary disk structure during recovery and lookup: the log may contain the newest committed truth.

## 14. Crash Recovery With a Journal
Crash recovery distinguishes partial transactions from complete transactions.

![Discard partial transactions](./lec23_materials/journaling_discard_partial.png)

If recovery scans the log and detects a transaction start with no matching commit, it discards the log entries. The disk remains unchanged because the transaction never committed.

![Keep complete transactions](./lec23_materials/journaling_keep_complete.png)

If recovery finds both a start and a matching commit, it keeps the complete transaction. It can redo it as usual, or simply let replay happen later. Redo is safe because the commit record proves that the transaction was meant to take effect.

:::remark Question: Why can recovery discard partial transactions but replay committed ones?
A partial transaction has no durable commit marker, so the system is allowed to treat it as never having happened. A committed transaction has a durable commit marker, so the system must preserve its effects. The log gives recovery a clear binary rule: no commit means discard; commit means redo or keep.
:::

## 15. Journaling Summary
Journaling makes updates atomic even if the system crashes:

- an update either gets fully applied or discarded;
- all physical operations are treated as one logical unit.

The cost is write amplification. If all data is journaled, the system writes data twice: once to the log and once to actual data blocks in the target file. Modern file systems often journal metadata updates only. They record modifications to file-system data structures but apply file-content updates directly.

## 16. Societal-Scale Distributed Systems
The world is a large distributed system. Microprocessors appear in everything, and vast infrastructure connects them: sensor networks, Internet connectivity, databases, remote storage, online games, commerce, and massive clusters that provide scalable, reliable, secure services.

A centralized system is:

**Centralized System: System in which major functions are performed by a single physical computer**.

A distributed system is:

**Distributed System: physically separate computers working together on some task**.

![Centralized versus distributed systems](./lec23_materials/centralized_vs_distributed.png)

Early distributed systems often used multiple servers in the same room or building, called a cluster. Later systems include peer-to-peer and wide-spread collaboration.

## 17. Promise and Reality of Distributed Systems
Distributed systems are attractive because:

- they are cheaper and easier to build from many simple computers;
- power can be added incrementally;
- users can control some components;
- collaboration through network resources, such as network file systems, is easier.

The promise is:

- higher availability: if one machine goes down, use another;
- better durability: store data in multiple locations;
- more security: each piece may be easier to secure.

The reality is often harder:

- worse availability: the system may depend on every machine being up;
- worse reliability: data may be lost if any machine crashes;
- worse security: anyone in the world may attack the system;
- coordination becomes more difficult;
- trust, privacy, denial of service, and protocol correctness become harder.

Lamport's famous warning captures the surprise:

**A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable.**

:::remark Question: Why can distribution make availability worse rather than better?
Distribution adds dependencies. If a service is designed so every component must respond, then any one component failure can break the whole service. Distribution improves availability only when the design can tolerate missing, slow, or failed components.
:::

## 18. Transparency Goals
**Transparency: the ability of the system to mask its complexity behind a simple interface**.

Possible transparencies include:

| Transparency | Meaning |
|---|---|
| Location | Users cannot tell where resources are located. |
| Migration | Resources may move without the user knowing. |
| Replication | Users cannot tell how many copies of a resource exist. |
| Concurrency | Users cannot tell how many users there are. |
| Parallelism | The system may speed up large jobs by splitting them into smaller pieces. |
| Fault tolerance | The system may hide various things that go wrong. |

Transparency and collaboration require a way for different processors to communicate.

## 19. Protocols
A protocol is a rule system for communication.

![Protocol as state-machine coordination](./lec23_materials/protocol_state_machine.png)

The key definition is:

**A protocol is an agreement on how to communicate**.

It includes:

- syntax: how communication is specified and structured, including message format and order;
- semantics: what communication means, including actions on send, receive, or timer expiration.

A protocol can be described formally by a state machine. It is often represented as a message transaction diagram. It can also be a partitioned state machine, where two parties synchronize duplicate sub-state machines between them. Stability under failure is part of the design.

## 20. Human Protocol Example: Telephone
A telephone call is a familiar protocol:

1. Pick up or open the phone.
2. Listen for a dial tone or verify service.
3. Dial.
4. Hear ringing.
5. Callee says "Hello?"
6. Caller identifies themselves, for example "Hi, it's John."
7. Caller sends the main message and pauses.
8. Callee replies and pauses.
9. Caller says bye.
10. Callee says bye.
11. Hang up.

This example shows both syntax and semantics. The order matters, and each message changes what the other side is expected to do next.

:::remark Question: Why is a protocol more than a list of messages?
A protocol also defines what each message means and what state transition it causes. For example, "Bye" does not just transmit text; it tells the other side the conversation is ending and that hanging up is now valid.
:::

## 21. Distributed Applications and Message Passing
A distributed application has to synchronize multiple threads running on different machines. There is no shared memory, so local synchronization instructions such as test-and-set are not enough.

![Distributed send and receive mailbox](./lec23_materials/distributed_send_receive_mailbox.png)

One abstraction is send/receive messages. Message delivery is already atomic in the sense that no receiver gets part of a message and two receivers cannot get the same message.

The interface is:

- `Mailbox (mbox)`: a temporary holding area for messages, including destination location and queue.
- `Send(message, mbox)`: send a message to the remote mailbox identified by `mbox`.
- `Receive(buffer, mbox)`: wait until `mbox` has a message, copy it into `buffer`, and return.
- If threads are sleeping on the mailbox, receiving a message wakes up one of them.

## 22. Distributed Consensus Making
The consensus problem is:

- all nodes propose a value;
- some nodes may crash and stop responding;
- eventually, all remaining nodes decide on the same value from the set of proposed values.

Distributed decision making is often choosing between `true` and `false`, or between `commit` and `abort`.

Durability is equally important. Decisions must not be forgotten. This is the "D" in ACID for a database. In a global-scale system, durability may require erasure coding, massive replication, or stable storage on multiple machines.

:::remark Question: Why does consensus need durability?
If a node decides `commit` but forgets that decision after a crash, it may later behave as if the decision never happened. A distributed decision is only meaningful if participants can recover and remember what they promised or decided.
:::

## 23. Two General's Paradox
The Two General's Paradox asks whether unreliable messages can guarantee simultaneous coordinated action.

![Two General's Paradox](./lec23_materials/two_generals_paradox.png)

The constraints are:

- two generals are on separate mountains;
- they can communicate only through messengers;
- messengers can be captured;
- they must coordinate an attack;
- if they attack at different times, they lose;
- if they attack at the same time, they win.

The surprising result is:

**No, messages over an unreliable network cannot guarantee that two entities do something simultaneously, even if all messages get through.**

![Unreliable acknowledgments in Two General's Paradox](./lec23_materials/two_generals_unreliable_messages.png)

The reason is the last-message problem. If one side sends "11am works", the other can acknowledge. But then the first side may wonder whether the acknowledgment arrived. Acknowledging the acknowledgment creates another message whose delivery is uncertain. There is no final message that both sides know was received.

:::remark Question: Why does the Two General's Paradox not disappear if every actual message happens to arrive?
The problem is knowledge, not only delivery. Even if the message arrives in reality, a participant cannot know that the other side knows that it arrived, and cannot know that the other side knows that they know, and so on. Simultaneous guaranteed action requires common knowledge, which unreliable messaging cannot create.
:::

## 24. Two-Phase Commit
Two-Phase Commit does not solve simultaneous action. It solves a related distributed transaction problem:

**Distributed transaction: Two or more machines agree to do something, or not do it, atomically**.

There is no requirement that everyone acts at the same time. The requirement is that all surviving machines eventually reach the same decision.

Two-Phase Commit was developed by Jim Gray. It uses a persistent stable log on each machine to track whether commit has happened. If a machine crashes, when it wakes up it first checks its log to recover the state at the time of crash.

## 25. Two-Phase Commit Protocol
Two-Phase Commit has two phases.

Prepare phase:

1. The global coordinator asks all participants to promise that they can commit or roll back the transaction.
2. Each participant records its promise in its log.
3. Each participant acknowledges the coordinator.
4. If anyone votes to abort, the coordinator writes `Abort` in its log, tells everyone to abort, and each participant records `Abort` in its log.

Commit phase:

1. If all participants respond that they are prepared, the coordinator writes `Commit` to its log.
2. The coordinator asks all nodes to commit.
3. Participants commit and respond with ACK.
4. After receiving ACKs, the coordinator writes `Got Commit` to its log.

The log guarantees that all machines either commit or do not commit.

## 26. Detailed 2PC Algorithm
The high-level algorithm has one coordinator and `N` workers.

![Two-phase commit detailed algorithm](./lec23_materials/two_phase_commit_detailed_algorithm.png)

Coordinator algorithm:

- Send `VOTE-REQ` to all workers.
- If `VOTE-COMMIT` is received from all `N` workers, send `GLOBAL-COMMIT` to all workers.
- If `VOTE-COMMIT` is not received from all `N` workers, send `GLOBAL-ABORT` to all workers.

Worker algorithm:

- Wait for `VOTE-REQ` from coordinator.
- If ready, send `VOTE-COMMIT` to coordinator.
- If not ready, send `VOTE-ABORT` to coordinator and immediately abort.
- If `GLOBAL-COMMIT` is received, commit.
- If `GLOBAL-ABORT` is received, abort.

:::remark Question: Why must a worker record its vote in stable storage?
After voting commit, the worker has promised that it can commit if asked. If it crashes and forgets that promise, it may later make a decision inconsistent with the coordinator's recorded decision. Stable storage makes the vote recoverable.
:::

## 27. Failure-Free Execution
In a failure-free execution, the message flow is straightforward.

![Two-phase commit failure-free execution](./lec23_materials/two_phase_commit_failure_free.png)

1. The coordinator sends `VOTE-REQ` to every worker.
2. Each worker replies `VOTE-COMMIT`.
3. The coordinator receives all commit votes.
4. The coordinator sends `GLOBAL-COMMIT`.
5. Workers commit.

If any worker had replied `VOTE-ABORT`, the coordinator would send `GLOBAL-ABORT` instead.

## 28. Coordinator and Worker State Machines
The coordinator implements a simple state machine.

![Coordinator state machine](./lec23_materials/two_phase_commit_coordinator_state.png)

Coordinator states:

- `INIT`: on `START`, send `VOTE-REQ` and enter `WAIT`.
- `WAIT`: if any `VOTE-ABORT` is received, send `GLOBAL-ABORT` and enter `ABORT`.
- `WAIT`: if all `VOTE-COMMIT` messages are received, send `GLOBAL-COMMIT` and enter `COMMIT`.
- `ABORT` and `COMMIT` are terminal decisions.

Workers also implement a simple state machine.

![Worker state machine](./lec23_materials/two_phase_commit_worker_state.png)

Worker states:

- `INIT`: on `VOTE-REQ`, either send `VOTE-ABORT` and enter `ABORT`, or send `VOTE-COMMIT` and enter `READY`.
- `READY`: on `GLOBAL-ABORT`, enter `ABORT`.
- `READY`: on `GLOBAL-COMMIT`, enter `COMMIT`.

The key risk is the worker `READY` state: the worker has voted yes and must wait for the coordinator's final decision.

## 29. Dealing With Worker Failures
Worker failure affects states in which the coordinator is waiting for messages. The coordinator only waits for votes in the `WAIT` state.

![Two-phase commit worker failure](./lec23_materials/two_phase_commit_worker_failure.png)

If the coordinator is in `WAIT` and does not receive all `N` votes, it times out and sends `GLOBAL-ABORT`. In the example, worker 3 fails before its vote reaches the coordinator. The coordinator cannot get all votes, so timeout leads to abort.

:::remark Question: Why is abort safe when a worker fails before voting commit?
Before the worker's `VOTE-COMMIT` is durably recorded and received, the coordinator has no unanimous approval. Since 2PC commits only with unanimous approval, abort is safe.
:::

## 30. Dealing With Coordinator Failure
Coordinator failure is more serious.

![Coordinator failure and blocking](./lec23_materials/two_phase_commit_coordinator_failure_blocking.png)

A worker waits for `VOTE-REQ` in `INIT`. If the coordinator fails before sending `VOTE-REQ`, the worker can time out and abort.

But a worker waits for a `GLOBAL-*` message in `READY`. If the coordinator fails after the worker voted `VOTE-COMMIT`, the worker must block waiting for the coordinator to recover and send `GLOBAL-COMMIT` or `GLOBAL-ABORT`.

![Coordinator failure recovery example](./lec23_materials/two_phase_commit_coordinator_failure_recovery.png)

In the recovery example, some workers have already sent `VOTE-COMMIT`, one worker is blocked waiting for the coordinator, and the coordinator restarts. After recovery, the coordinator uses its stable log and sends the final decision, such as `GLOBAL-ABORT`.

:::remark Question: Why can a READY worker not simply abort after coordinator failure?
After voting commit, the worker has promised to commit if the final decision is commit. The coordinator may already have recorded `Commit` before crashing. If the worker unilaterally aborts, it may violate atomicity. Therefore the worker must wait until it learns the coordinator's final decision.
:::

## 31. Durability in 2PC
All nodes use stable storage to store their current protocol state.

**Stable storage is non-volatile storage, such as disk-backed storage, that guarantees atomic writes.**

Examples include SSDs and NVRAM. After recovery, nodes restore state and resume:

| Node state after recovery | Action |
|---|---|
| Coordinator in `INIT`, `WAIT`, or `ABORT` | Abort. |
| Coordinator in `COMMIT` | Commit. |
| Worker in `INIT` or `ABORT` | Abort. |
| Worker in `COMMIT` | Commit. |
| Worker in `READY` | Ask the coordinator for the final decision. |

Stable logs turn crashes into pauses. A recovering node can continue from its durable protocol state instead of guessing.

## 32. Discussion: Why 2PC Works and Why It Blocks
Distributed decision making is desirable because it provides fault tolerance. A group of machines can come to a decision even if one or more fail during the process, assuming a simple fail-stop failure model. After a decision is made, the result is recorded in multiple places.

2PC is not subject to the Two General's Paradox because it is not trying to guarantee simultaneous action. It is about all nodes eventually coming to the same decision. Rebooting and continuing gives the system time to collect and collate decisions.

The undesirable feature of 2PC is blocking:

1. Site B writes `prepared to commit` to its log.
2. Site B sends a yes vote to coordinator Site A.
3. Site B crashes.
4. Site A also crashes.
5. Site B wakes up, checks its log, and sees it voted yes.
6. Site B asks Site A what happened.
7. Site B cannot decide to abort because the update may already have committed.
8. Site B remains blocked until Site A returns.

A blocked site holds resources such as locks on updated items and pages pinned in memory until it learns the fate of the update.

:::remark Question: Why is blocking the price of 2PC's simplicity?
2PC has one coordinator that owns the final decision. If participants have voted commit but have not learned the final decision, they cannot safely decide alone. More advanced consensus protocols reduce this blocking risk by replicating decision authority, but they are more complex.
:::

## 33. Summary
Important system properties are:

- availability: how often the resource is available;
- durability: how well data is preserved against faults;
- reliability: how often the resource performs correctly.

RAID improves storage reliability using redundancy, such as RAID 1 mirroring and RAID 5 parity blocks. Copy-on-write provides richer functions such as versions and simpler recovery, often with little performance impact because sequential writes to storage are cheap. Logs improve reliability in journaled file systems such as ext3 and NTFS.

Transactions over a log provide a general solution:

- commit the sequence to a durable log, then update disk;
- log takes precedence over disk;
- replay committed transactions and discard partial transactions.

A protocol is an agreement between parties about how information is transmitted. Two-phase commit is a distributed decision-making protocol: first make sure everyone guarantees they will commit if asked, then ask everyone to commit.

## Exam Review
You should be able to explain the following points without looking back:

1. **Careful ordering writes structures in a safe order and uses recovery to clean up incomplete operations.**
2. **When writing data and a pointer, write data first and pointer last.** Data without a pointer is recoverable; a pointer to invalid data is dangerous.
3. **`fsck` recovery can be proportional to disk size because it scans global metadata structures.**
4. **Copy-on-write writes a new version instead of overwriting the old one.** Recovery keeps either the old complete version or the new complete version.
5. **A transaction is an atomic sequence of reads and writes that takes the system from one consistent state to another.**
6. **The bank-transfer example requires atomicity because debit, credit, and branch-balance updates must all commit together.**
7. **A log uses durable append records to make a multi-step operation recoverable.** No commit means discard; commit means replay or keep.
8. **Journaled file systems use the log for recovery; log-structured file systems keep data in log form.**
9. **Distributed systems promise availability, durability, and collaboration, but create coordination, security, and failure-dependency problems.**
10. **Transparency hides distribution details such as location, migration, replication, concurrency, parallelism, and failures.**
11. **A protocol defines communication syntax and semantics, often as a state machine.**
12. **The Two General's Paradox shows that unreliable messaging cannot create guaranteed simultaneous action.**
13. **Two-Phase Commit solves eventual distributed agreement on commit or abort, not simultaneous action.**
14. **2PC commits only after unanimous `VOTE-COMMIT`; otherwise it aborts.**
15. **A READY worker that voted commit must block if the coordinator fails, because the final decision may already have been commit.**
