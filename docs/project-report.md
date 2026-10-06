# PrintFlow — Smart Printer Job Management System

**BE Engineering · 5th Semester · Data Structures and Algorithms Mini Project**

## 1. Introduction

PrintFlow applies fundamental data structures to a print-desk workflow. A React interface supports customers and staff, while an Express backend persists documents, orders and jobs in MongoDB. Custom queue algorithms determine how work moves between scheduling, printer stations and quality checks.

## 2. Problem statement

A print desk must handle documents with different urgency, deadlines and printer requirements. Managing these requests without a shared workflow can make order status unclear, overload one printer, and omit finishing checks. The project addresses how to organize these requests using appropriate data structures and persistent state.

## 3. Objectives

- Implement FIFO, priority and circular queues with understandable invariants and complexity.
- Connect all three structures to actual order and job processing.
- Route jobs to compatible printer stations without exceeding buffer capacity.
- Preserve progress and queue order sufficiently to recover after server restarts.
- Provide customer tracking, staff controls and an interactive DSA demonstration.
- Package frontend and backend as one Render application.

## 4. Existing system

The baseline problem is a manually coordinated print desk using verbal requests or simple lists. Such approaches do not inherently provide priority ordering, per-printer buffer bounds, authenticated tracking or a FIFO inspection stage. This is a problem model, not a measured survey of an institution. The supplied target folder was empty, so there was no earlier application to preserve or compare experimentally.

## 5. Proposed system

Members upload documents and select print settings. The backend calculates page and paper requirements and persists a print request/job. A binary heap selects pending jobs; a compatibility router feeds circular printer buffers. Operators report real printing results, and printed jobs enter a linked FIFO for quality control. Failed attempts can create linked reprints. The application displays persisted status through REST and Socket.IO updates.

## 6. Technology stack

Node.js 22, Python 3.10+, Express 5, MongoDB Atlas with Mongoose/GridFS, Socket.IO, React, Vite, React Router, pdf-lib, bcrypt, JWT cookies, Zod and custom Python queue classes. npm workspaces provide root installation, build and start commands. Render hosts one web service containing Node and its local standard-library Python worker.

## 7. System architecture

```text
React → Express API → Business services → DSA scheduler → MongoDB
           |
           +→ Socket.IO events → authorized browser sessions

Priority heap → compatible station → circular waiting buffer
                                      |
                                 operator printing
                                      |
                                 linked FIFO → QC
```

Express also serves the built SPA and a history fallback. All production HTTP/socket requests use one origin. See [architecture](architecture.md).

## 8. DSA concepts

- **Queue:** linked head/tail FIFO for quality checks; enqueue/dequeue/peek O(1), storage O(n).
- **Priority Queue:** binary heap ordered by descending score, then deadline and arrival; insertion/removal O(log n), peek O(1), storage O(n).
- **Circular Queue:** fixed-capacity station buffer with modulo wrap-around; basic queue operations O(1), storage O(c).
- **Scheduler:** combines the three structures with compatibility selection and durable transitions; full dispatch CPU work O(n log n + n·p), excluding database latency.

The algorithms and production integration are in `backend/src/dsa/`. Inspection/snapshot operations have traversal costs distinct from individual queue operations. See [DSA explanation](dsa.md) and [mapping](dsa-mapping.md).

## 9. Implementation

Backend validation and database transactions preserve order/job/stock consistency. Node serializes workflow mutations, while the local Python worker owns all DSA structures and algorithms. Private JSON-lines messages connect them; database reconstruction recovers from Node/worker restart or failed writes. GridFS holds uploaded bytes independent of the web host's filesystem. The backend derives paper requirements from validated instructions and stores a print summary with the request. React uses role-aware routes, server resources and authenticated socket invalidation. The DSA lab uses the same Python classes through `demo.py`.

## 10. Features

Authenticated uploads, PDF page counting, print settings, paper previews, print request tracking, priority scheduling, bounded printer buffers, manual printer progress, QC, reprints, paper inventory, multi-printer routing, role management, audit history and interactive queue visualization. See [features](features.md) for exact component mappings and scope.

## 11. Database design

Persistent models are User, Document, Order, PrintJob, Printer, Inventory and AuditLog, plus GridFS files/chunks. Orders link a customer and document to the original print attempt and reprints. Jobs reference printers and retain stage timestamps. Unique indexes support email identity, printer names and customer-scoped order submission keys. See [database](database.md).

## 12. Results and evaluation status

The delivered artifacts are application source, a dependency lockfile, one-service Render configuration, and explanatory documentation. **No application build, automated test, browser test, MongoDB connection, deployment, physical-printer evaluation or performance experiment has been executed for this coding-only task.**

The algorithmic complexity claims follow from the implementation and are not measured latency results. Do not present this report as proof of successful deployment or benchmark performance. The project owner should record actual outcomes using [acceptance](acceptance.md), including environment, date, expected/observed behavior and any failures, before submitting experimental results.

## 13. Advantages

Clear data-structure-to-feature mapping; separation of persistent data and runtime scheduling; bounded station buffers; role-controlled operations; repeatable root build workflow; durable upload storage; and a demonstrable QC/reprint lifecycle. These are design properties, not quantified comparative claims.

## 14. Limitations

- One backend scheduler process; no distributed lock or multi-instance deployment guarantee.
- Operator-controlled physical printing and printer status; no automatic spooler or device telemetry.
- Non-preemptive station FIFO; rush work cannot interrupt an assigned buffer; no aging or deadline guarantee.
- Render Free can sleep and restart; real-time events are not a durable replay stream.
- PDF/PNG/JPEG only; no Office conversion, OCR or antivirus scanning.
- No online payments, delivery tracking, password recovery or full consumables accounting.
- Upload bytes and metadata are separate writes; abrupt crashes may leave orphan files.
- No measured validation results are included.

## 15. Future scope

Physical printer agents with acknowledgements, secure document conversion, password recovery, stock corrections and toner accounting, durable event replay, scheduling aging, centralized multi-instance coordination, payment integration, automated regression checks and measured workload evaluation.

## 16. Conclusion

PrintFlow provides a concrete academic implementation in which the heap, circular queues and linked FIFO participate in the application's real execution path. Its structure supports explaining data-structure operations, complexity, persistence and scheduling tradeoffs during a fifth-semester DSA evaluation. Functional and deployment results must be established by executing the owner's acceptance checks.

## Interface design

PrintFlow is a shared printing utility for shops, campuses, offices and labs. A Y2K/Memphis theme combines chrome gradients, digital typography and grids with bold borders, lilac/lime/cyan/peach blocks, squiggles and geometric motifs. The launchpad exposes print submission, tracking and role-appropriate station tools. Pricing and storefront features have been removed. Runtime and browser evaluation remain the project owner's responsibility.
