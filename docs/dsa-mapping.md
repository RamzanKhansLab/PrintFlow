# Python DSA → PrintFlow mapping

| DSA | Actual use | Operations | Core complexity | Python source |
| --- | --- | --- | --- | --- |
| Linked Queue | QC waiting line | enqueue / dequeue / peek | O(1) each | `backend/src/dsa/queue/Queue.py` |
| Binary-heap Priority Queue | Print job admission / reprints | enqueue / dequeue / peek | O(log n) / O(log n) / O(1) | `backend/src/dsa/priorityQueue/PriorityQueue.py` |
| Circular Queue | Bounded waiting buffer per printer | enqueue / dequeue / peek / is_full | O(1) each | `backend/src/dsa/circularQueue/CircularQueue.py` |
| PrintScheduler | Routing and coordination | plan_dispatch / choose_printer / restore | Full pass O(n log n + n·p), excluding I/O | `backend/src/dsa/scheduler/PrintScheduler.py` |

FIFO/heap clear is O(n) in Python, ring clear O(c). Snapshots cost traversal. See [DSA explanation](dsa.md) for complete complexity details.

## API → integration → Python execution

All live Workflow operations enter `services/print-scheduler.js` for process-local serialization and MongoDB persistence, then use `services/python-dsa.js` to communicate with Python. The JavaScript services contain no heap, FIFO, ring, comparator or printer-routing implementation.

| Trigger | Node integration | Actual Python call / operation |
| --- | --- | --- |
| Place order | `Workflow.createOrder` → `priorityFor`, transaction, `enqueue` | `priority_for(config)`; `PrintScheduler.enqueue` → heap enqueue |
| Dispatch | `PrintSchedulerService.dispatch` | `PrintScheduler.plan_dispatch` → heap dequeue, `choose_printer`, ring enqueue; Node saves and confirms each assignment |
| Start station | `Workflow.startPrinter` → transaction → `startPrint` | `station()` peeks; `start_print()` dequeues ring head and records active job |
| Finish printing | `Workflow.finishPrinting` → transaction → `finishPrint` | `finish_print()` clears active slot, FIFO enqueue when PRINTED |
| Begin QC | `Workflow.startQualityCheck` → transaction → `startQualityCheck` | `quality_check()` peeks; `start_quality_check()` dequeues FIFO head |
| Pass/fail QC | `Workflow.finishQualityCheck` → transaction | `finish_quality_check()` clears active QC |
| Reprint failed job | `Workflow.reprint` → transaction → `enqueue` | Python score +20; new child job enters heap |
| Printer offline/error | `Workflow.setPrinterStatus` → transaction | `set_printer_status()` drains waiting ring into heap |
| Restart / worker failure | `PrintSchedulerService.restore` loads MongoDB | `PrintScheduler.restore` rebuilds actual Python structures |
| Operate lab | `/api/dsa/operate` → validated IPC request | `DsaDemo.operate` in `demo.py`, using the same production classes |

Package exports are in `backend/src/dsa/*/__init__.py`. `worker.py` dispatches a fixed set of JSON commands over stdin/stdout; it exposes no HTTP port and accepts no user-supplied Python code.

## Viva walkthrough

1. Open the four Python class files and explain their fields and invariants.
2. Explain descending priority, ascending deadline and arrival tie breakers.
3. Demonstrate FIFO order, heap removal and ring wrap-around in the lab.
4. Place a real order, print it and complete QC; follow the table above.
5. Explain that MongoDB persists jobs, Python schedules, and Node handles HTTP/database/socket integration.
6. State the limits: one application instance with one worker, non-preemptive rings, manual physical printing, and no claimed benchmark results.
