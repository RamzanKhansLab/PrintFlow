# Queue system and lifecycle

## Job and order states

```text
PrintJob:
QUEUED → ASSIGNED → PRINTING → PRINTED → QUALITY_CHECK → COMPLETED
   \         \         \                      \
    CANCELLED           FAILED                 FAILED
                          \                     /
                           explicit reprint request
                                    |
                           new QUEUED PrintJob
```

| Job transition                    | Trigger                                     | Order status  | Runtime change                              |
| --------------------------------- | ------------------------------------------- | ------------- | ------------------------------------------- |
| Create → QUEUED                   | Member submits request                      | QUEUED        | Heap enqueue                                |
| QUEUED → ASSIGNED                 | Scheduler finds compatible online station   | QUEUED        | Heap dequeue, ring enqueue                  |
| ASSIGNED → PRINTING               | Operator starts ring head; stock sufficient | IN_PROGRESS   | Ring dequeue, set station active            |
| PRINTING → PRINTING               | Operator increases progress 0–99            | IN_PROGRESS   | Update active job snapshot                  |
| PRINTING → PRINTED                | Operator reports physical print complete    | QUALITY_CHECK | Clear station active; FIFO enqueue          |
| PRINTED → QUALITY_CHECK           | Operator starts FIFO head                   | QUALITY_CHECK | FIFO dequeue, set global QC active          |
| QUALITY_CHECK → COMPLETED         | QC passes                                   | READY         | Clear QC active                             |
| PRINTING / QUALITY_CHECK → FAILED | Operator reports failure, with reason       | ATTENTION     | Clear the appropriate active slot           |
| Failed job → new child QUEUED job | Explicit reprint request                    | QUEUED        | New job enters heap with priority boost     |
| QUEUED / ASSIGNED → CANCELLED     | Authorized cancellation before starting     | CANCELLED     | Remove waiting job                          |
| ASSIGNED → QUEUED                 | Station goes offline/error                  | QUEUED        | Waiting ring drains into heap for rerouting |

Orders currently contain one original document/job and any subsequent reprint attempts. Failed predecessors remain in history. A failed job can have only one direct reprint child. A failed child can in turn receive its own child. Reprints preserve the request settings and create a new attempt; starting that attempt consumes additional sheets.

## Admission and scheduling

The heap uses priority, deadline and arrival in that order. Standard score is 10, rush 100, and a reprint adds 20. A full dispatch considers every pending job once, uses a second custom heap for jobs that cannot be assigned, and places compatible jobs into waiting rings. One incompatible urgent job therefore does not prevent other compatible work from being assigned.

Routing chooses the compatible online station with the least waiting-plus-active load. Buffers have 1–20 waiting slots; the active print is separate. Assignment is conditional on MongoDB still recording `QUEUED`.

Priority applies at admission, not inside already assigned printer buffers. This is a non-preemptive scheduler. It does not interrupt printing, promise deadlines, or implement priority aging. Paper checks occur at printer start; a station head waiting for stock is not automatically skipped.

## Serialization and errors

Every scheduler mutation passes through `PrintSchedulerService.exclusive()`, a promise chain in Node. Business transitions use MongoDB transactions with audit records; job/order/inventory changes commit together, followed by Python queue updates. For dispatch, Python first plans heap-to-ring moves, Node conditionally persists and confirms each assignment, and only then releases queue readers. Failed/incomplete plans are discarded by restoring Python state from MongoDB. There are no JavaScript scheduling queues.

The scheduler rebuilds from MongoDB after an operation fails, so an abandoned runtime mutation is not treated as truth. A response can be lost after a commit; callers should refresh before repeating an action. Order creation uses `(customer, clientRequestId)` as an idempotency key. State checks prevent a printer start from consuming stock twice and prevent duplicate reprints. Restock is additive and is **not** request-key idempotent; inspect stock after an uncertain response before submitting again.

## Restart reconstruction

1. Load printer capabilities/status/capacity and make an empty circular buffer for each.
2. Enqueue persisted QUEUED jobs into the heap.
3. Restore ASSIGNED jobs by `assignedAt`, `createdAt`, then `_id` into the corresponding station buffer. A missing/full station sends an assigned job back to QUEUED.
4. Preserve each PRINTING job as that station's active job. An operator must verify the physical result before reporting completion or failure.
5. Restore PRINTED jobs by `printedAt`, then `_id` into the FIFO QC line.
6. Preserve the active QUALITY_CHECK job.
7. Run dispatch for queued work.

Recovery can normalize physical ring indexes; it preserves logical FIFO order. Conflicting active records cause recovery to report unavailable rather than assume which job printed. Database disconnects clear readiness; recovery retries every 30 seconds and before subsequent mutations.

This is not a distributed scheduler. Run one backend instance with its one local Python worker against the database and pause workflow changes during deployments. A worker exit/15-second IPC timeout clears readiness and triggers reconstruction on the next workflow action or recovery timer. Sandbox state resets when the worker restarts. Socket events can be missed during a restart; REST reloads restore the browser view.
