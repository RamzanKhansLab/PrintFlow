# Python data structures and algorithms in PrintFlow

All queue implementations and scheduling algorithms are **Python** files in `backend/src/dsa/`. The Node/Express API uses a single local Python worker over private stdin/stdout pipes. MongoDB access, transactions and Socket.IO remain in Node. Both live jobs and `/admin/dsa` execute these Python classes; there is no duplicate JavaScript queue implementation.

## Source layout

```text
backend/src/dsa/
  __init__.py
  queue/Queue.py
  priorityQueue/PriorityQueue.py
  circularQueue/CircularQueue.py
  scheduler/PrintScheduler.py
  demo.py                 # Per-staff lab using the same Python classes
  worker.py               # Private JSON-lines command dispatcher
  errors.py
```

Each structure directory contains `__init__.py` for package imports. Python 3.10+ is required; only the standard library is used. There are no pip packages, `heapq`, `collections.deque`, or external queue libraries behind the algorithms.

## 1. Queue — linked FIFO

**Definition:** first in, first out. A dataclass `Node` holds a `value` and a `next` link. The Queue retains `head`, `tail`, and `length`.

**Purpose:** printed jobs waiting for quality control. A completed print enters this queue in `PRINTED`; the oldest waiting item becomes the active `QUALITY_CHECK` when an operator starts the next inspection.

**Source:** [Queue.py](../backend/src/dsa/queue/Queue.py).

| Operation | Implementation | Time |
| --- | --- | --- |
| `enqueue(value)` | Link a new node after tail; initialize head for an empty queue | O(1) |
| `dequeue()` | Return head value and advance head; empty returns `None` | O(1) |
| `peek()` | Read head without removal | O(1) |
| `is_empty()`, `size()` | Read the counter | O(1) |
| `clear()` | Dequeue until all nodes are unlinked | O(n) |
| `to_list()` | Walk the linked nodes for inspection | O(n) |

Space is O(n) nodes, with another O(n) allocation for a list snapshot. Cleanup is explicitly O(n) in this Python version; it is not mislabeled as a constant-time operation.

Example: enqueue A, B, C; peek returns A; dequeue returns A; B becomes the head. In the real workflow, Node commits the printing result and calls Python `PrintScheduler.finish_print()`, which runs `self.qc.enqueue(job)`. QC start peeks in Python, commits the state change in MongoDB, and calls `start_quality_check()` to dequeue that same head.

## 2. Priority Queue — custom binary heap

**Definition:** a complete binary tree represented by a Python list. Parent index is `(i - 1) // 2`; children are `2*i + 1` and `2*i + 2`.

**Source:** [PriorityQueue.py](../backend/src/dsa/priorityQueue/PriorityQueue.py).

`compare_jobs` ranks jobs by:

1. Higher priority score.
2. Earlier deadline, with a missing deadline treated as infinity.
3. Earlier `createdAt` arrival.
4. Identifier, then insertion sequence if the comparator still ties.

Enqueue appends a leaf and explicitly bubbles it up through parent comparisons/swaps. Dequeue replaces the root with the last leaf and explicitly bubbles down toward the better child. The list is a heap layout, not a sorted list. The implementation uses neither `heapq` nor `sorted()`/`list.sort()`.

| Operation | Time | Extra space |
| --- | --- | --- |
| `enqueue(job)` | O(log n), with amortized list append | O(1) apart from list growth |
| `dequeue()` | O(log n) | O(1) |
| `peek()`, `is_empty()`, `size()` | O(1) | O(1) |
| `clear()` | O(n), releasing list entries | O(1) |
| `to_list()` | O(n), heap layout snapshot | O(n) |
| `ordered()` | O(n log n), repeatedly dequeue from a copied heap | O(n) |

Total storage is O(n). Empty dequeue/peek return `None`. The final-element `list.pop()` in the heap is O(1); there is no front-removal `pop(0)`.

Example: JOB-101 score 2, JOB-102 score 4, JOB-103 score 1. Peek/dequeue selects JOB-102, then JOB-101, then JOB-103. Equal scores use deadlines and arrival times.

Actual use: after a MongoDB transaction creates an order or reprint, Node sends `enqueue` to Python. `PrintScheduler.plan_dispatch()` removes heap roots and tries to route them to printer rings. Incompatible jobs are moved into another custom heap so an incompatible high-priority job does not block compatible lower-priority jobs.

## 3. Circular Queue — bounded printer buffer

**Definition:** a fixed-capacity FIFO that reuses vacated list slots by modulo wrap-around.

**Source:** [CircularQueue.py](../backend/src/dsa/circularQueue/CircularQueue.py).

The fields are `capacity`, `buffer`, `front` (next removal), `rear` (next insertion), and `length`. A counter distinguishes full and empty when both pointers coincide.

```python
# enqueue, after checking that the buffer is not full:
self.buffer[self.rear] = value
self.rear = (self.rear + 1) % self.capacity
self.length += 1

# dequeue, after checking that the buffer is not empty:
value = self.buffer[self.front]
self.buffer[self.front] = None
self.front = (self.front + 1) % self.capacity
self.length -= 1
```

Enqueue, dequeue, peek, `is_full`, `is_empty` and size are O(1). Storage and initialization/clear cost O(c), where c is capacity. `inspect()` copies c physical slots; `to_list()` traverses n occupied slots. A full enqueue raises `OverflowError`; invalid capacity raises `ValueError`; empty dequeue/peek return `None`.

| Operation, capacity 3 | Slots | Front | Rear | Logical order |
| --- | --- | --- | --- | --- |
| Enqueue A, B, C | `[A, B, C]` | 0 | 0 | A, B, C |
| Dequeue | `[None, B, C]` | 1 | 0 | B, C |
| Enqueue D | `[D, B, C]` | 1 | 1 | B, C, D |

Each real printer has one Python ring of capacity 1–20. The active print is stored separately from its bounded waiting buffer. The scheduler uses ring enqueue during planning. Node commits a printer start and paper deduction before Python dequeues the head in `start_print()`.

## 4. PrintScheduler — algorithms in Python

**Source:** [PrintScheduler.py](../backend/src/dsa/scheduler/PrintScheduler.py).

`priority_for()` assigns standard = 10, rush = 100, and reprint = +20. `compatible()` checks paper size, color and duplex. `choose_printer()` selects a compatible online station with free space and the smallest waiting-plus-active count; iteration order breaks equal station loads.

```text
New persisted job → Python PriorityQueue
                           ↓
                 Python compatibility/router
                           ↓
                 Python CircularQueue per printer
                           ↓
                    Operator prints
                           ↓
                 Python Queue → quality check
```

`plan_dispatch()` performs a whole heap/routing pass and returns the selected job/station pairs. Node conditionally persists each QUEUED → ASSIGNED transition, then calls `confirm_assignment()` to attach the committed job data to the buffered object. If a write or the worker fails, Node discards the speculative state and restores from MongoDB. Queue readers are serialized behind the entire dispatch and cannot see unconfirmed plans. Socket events only describe persisted assignments.

Priority controls admission to a station. It does not preempt an active print or reorder the existing ring. The scheduler implements no aging or guaranteed deadlines. Paper availability is checked at printer start; a head job cannot be skipped just because stock is insufficient.

Offline/error transitions drain unstarted ring jobs back to the Python heap after the status transaction commits. Active printing remains for human resolution. A failed print/QC creates no automatic retry: a staff reprint request creates a new durable child job, with additional paper consumed on its next start.

### Costs

For n pending jobs, p printers, c maximum ring capacity and q QC-waiting jobs:

- Full dispatch CPU work: O(n log n + n·p).
- Active scheduling storage: O(n + p·c + q + p).
- Cancellation: O(n log n + p·c), retaining heap entries and rotating ring buffers.
- Snapshot: O(n log n + p·c + q), including ordered heap inspection.
- Printer start / QC head queue operations: O(1).

MongoDB latency, IPC serialization and browser rendering are additional costs. A Python queue operation being O(1) does not make the whole HTTP request O(1). JSON transport visits its payload and the lab response includes full visualization snapshots.

### Persistence and recovery

MongoDB stores states, assignments and timestamps. Node loads queued/assigned/active records and supplies chronological lists to Python `restore()`. Python builds the actual heap and rings; printed jobs, supplied in `printedAt` order, rebuild FIFO. Active printing and QC remain active. Assigned jobs with a missing/full printer are requeued and persisted by Node. Contradictory active records fail recovery instead of assuming success.

One Node process owns one persistent Python worker. This is one deployed application with a private child process, not a separate Python HTTP service. A worker exit/timeout marks the scheduler unavailable. Recovery starts a fresh worker and reloads MongoDB before accepting workflow operations. A 30-second timer retries recovery; the next workflow mutation can also trigger it. A restarted worker loses only the temporary lab sessions; durable jobs are reconstructed. See [Python integration](python-dsa.md).

## 5. DSA laboratory

`/admin/dsa` calls the existing Express endpoints. `services/dsa-demo.js` only validates HTTP input, then calls Python `demo.py`. The sandbox imports the very same classes as the production scheduler. It displays linked FIFO items, heap levels/removal order and physical ring slots with pointers, plus live production scheduler counts.

Each staff account has a sandbox with FIFO/heap caps of 30 and a ring capacity of 5. Sessions expire after one hour of inactivity; at most 100 accounts are held. Sandbox operations never create real orders. The production scheduler button runs real scheduling.

For standalone Python exploration, open a terminal in `backend/src`, run `python` (`python3` on Linux), and use:

```python
from dsa.queue import Queue
from dsa.priorityQueue import PriorityQueue
from dsa.circularQueue import CircularQueue
from dsa.scheduler import PrintScheduler

queue = Queue()
queue.enqueue("A")
queue.enqueue("B")
queue.dequeue()  # A

heap = PriorityQueue()
heap.enqueue({"id": "JOB-101", "priorityScore": 2})
heap.enqueue({"id": "JOB-102", "priorityScore": 4})
heap.peek()  # JOB-102

ring = CircularQueue(2)
ring.enqueue("A")
ring.enqueue("B")
ring.dequeue()
ring.enqueue("C")
ring.inspect()  # slots [C, B], FIFO order [B, C], front=rear=1
```

These examples are instructions for evaluation, not recorded test results. Application testing remains with the project owner.
