# User flows

## First-time administrator

1. Install and configure the backend as in [setup](setup.md).
2. Start the application and register an account.
3. Promote that existing email with `npm run admin -- EMAIL`, then sign out/in.
4. Add actual printer capabilities in `/admin/printers`; set stations online when ready.
5. Add available paper in `/admin/inventory`.
6. Invite operators to register through the site, then assign their role in `/admin/users`.

There are no seeded credentials, invented stations, fake inventory, or sample orders.

## Member

1. Sign in, open `/print`, and upload a PDF/PNG/JPEG or select a recent upload.
2. Review the parsed page count. Choose pages, copies, color, paper, sides and binding.
3. Choose standard or rush and, optionally, a requested deadline.
4. Review the server-calculated page and sheet counts. Submit the request; the backend validates ownership and recalculates paper usage.
5. The order appears at `/requests/:id` with a `PF-XXXXXXXX` reference. `/track` accepts that reference but still requires the owner or staff session.
6. Watch queued → in progress → quality check → ready. Each reprint attempt appears in the order history.
7. Cancel only while the order remains queued and no printing has started. READY means the print desk passed the quality check and the order is available for collection.

No online payment, delivery booking or collection confirmation is part of this version.

## Operator

1. Open `/admin/dashboard` for actual queued, buffered, active and QC counts.
2. Inspect `/admin/queue`. The heap assigns jobs to compatible online stations with buffer capacity.
3. Open `/station/:printerId`. Start the next buffered job; the backend atomically checks/deducts paper and sets it active.
4. Download the document and apply the shown configuration using the physical printer. Finishing/binding is also performed manually.
5. Save progress if useful. Report printing finished only when it actually finishes, or mark failure with a reason.
6. Printed jobs join the FIFO QC line. Start the next QC in `/admin/queue`; check page count, readability, alignment, color and binding.
7. Pass QC to mark ready, or fail with notes. In `/admin/jobs`, filter failed jobs and create a reprint if required.

Putting a printer offline/error reroutes its unstarted buffer. An already active print remains for the operator to finish/fail. A restart also preserves active printing; check the physical printer before reporting a result to avoid unnecessary duplicates.

## DSA evaluation

1. Open `/admin/dsa` using an operator/admin account.
2. FIFO: clear, enqueue A/B/C, peek and dequeue. A leaves first.
3. Heap: clear, enqueue scores 2/4/1, inspect the heap root and removal order, then dequeue the score-4 job.
4. Ring: clear, insert five items, remove two, insert two. Observe physical slots reused and front/rear wrapping.
5. Read the displayed operation complexity and actual source path.
6. Use the production scheduler panel to observe the real workflow. Queue several member jobs with all printers offline, then bring a compatible station online to see heap-driven routing.
7. Complete real printing and QC stages to connect the class operations to application behavior.

Sandbox operations are per staff account and do not alter real orders. The production scheduler button does operate the real queue. These instructions describe what to demonstrate, not a previously executed evaluation.
