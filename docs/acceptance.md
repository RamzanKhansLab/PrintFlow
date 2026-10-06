# Owner's manual acceptance checklist

This is a **not-yet-executed** checklist. Coding and documentation were requested; the owner will perform application testing. No pass/fail outcomes are asserted here.

## 1. Installation and build

- [ ] Use Node 22.12+ in the 22.x line. Run `npm ci` at the root.
- [ ] Configure `backend/.env` with Atlas/replica-set URI and a random signing secret.
- [ ] Run `npm run dev`; confirm Vite at 5173 and backend health at 5000.
- [ ] Run `npm run build`, stop development servers, then `npm start`.
- [ ] Open localhost:5000 with local `NODE_ENV=development`; confirm SPA and API share the origin.
- [ ] Reload `/guide`, `/print`, `/requests`, `/admin/dsa` and an actual station URL directly.
- [ ] Check `/api/not-a-route` returns JSON 404; a nonexistent static `.js` asset must not return SPA HTML.

## 2. Accounts and access

- [ ] Register member A and member B with different browser profiles.
- [ ] Promote a registered admin locally with `npm run admin -- EMAIL`; sign in again.
- [ ] Create a separate operator through normal registration and admin role management.
- [ ] A member cannot call staff/admin APIs, open another member's request, or download their document.
- [ ] An operator can operate queues but cannot add printers, change roles or read the admin audit endpoint.
- [ ] Registration rejects an injected `role` field; duplicate email is rejected.
- [ ] Log out and verify protected API access fails in that browser; check role-change socket disconnection.

## 3. Uploads, paper previews and requests

- [ ] Upload a known multi-page PDF; compare reported page count. Upload PNG/JPEG; each is one page.
- [ ] Reject invalid bytes, unsupported/Office files, encrypted PDFs and files larger than 10 MB.
- [ ] A download returns the original bytes only to the owner/staff.
- [ ] Test `1-3,5`, overlapping ranges, invalid ranges, duplex odd-page counts and multiple copies.
- [ ] Retry order creation using the same customer/UUID; it resolves to one order and original job.
- [ ] Check the customer's order detail, list and private reference tracking.
- [ ] Cancel before starting; verify order/job cancellation and queue removal. Reject cancellation after start.

## 4. Real scheduling

- [ ] Add a monochrome A4 station and a color/duplex A4/A3 station with small buffers. Initially leave both offline.
- [ ] Queue standard/rush jobs and jobs with equal priority but different deadlines/arrival times. Inspect heap/removal order in `/api/queue`.
- [ ] Bring a compatible printer online. Confirm it receives the expected highest-priority compatible work without exceeding capacity.
- [ ] Verify an incompatible high-priority job does not block lower-priority compatible jobs.
- [ ] Confirm a later rush job does not reorder an already assigned ring; this is the documented non-preemptive behavior.
- [ ] Try starting with no paper: receive 409, unchanged stock/job. Restock and start: consume exactly the required sheets once.
- [ ] Try duplicate start and decreasing progress: reject without double consumption.
- [ ] Start/finish successive jobs and observe station ring front/rear wrap-around during normal successful operations.
- [ ] Set a station offline/error with waiting work: it returns to the heap and reroutes if another compatible station is available. Active printing remains active.

## 5. QC and reprints

- [ ] Mark two real operator prints finished in known order. QC waiting order matches that completion order.
- [ ] Start the head QC; a second active QC is rejected.
- [ ] Pass: job becomes COMPLETED, order READY. Fail: reason is required and order becomes ATTENTION.
- [ ] Create one reprint from a failed job; repeated reprint of the same parent is rejected.
- [ ] Confirm the child retains config/deadline, has +20 reprint priority relative to its scheduling priority, and links to the parent.
- [ ] Starting the reprint consumes new paper. The failed job and original print instructions remain in history.

## 6. DSA lab

- [ ] FIFO: enqueue A, B, C; peek A; dequeue A, then B; clear; verify empty result.
- [ ] Heap: enqueue JOB-101/2, JOB-102/4, JOB-103/1; peek/dequeue JOB-102. Check equal-priority deadline/arrival ordering.
- [ ] Ring: fill 5 slots; sixth enqueue fails; dequeue twice; enqueue twice; front/rear wrap while FIFO order remains correct.
- [ ] Check operation results, physical slots, heap levels, complexity text and source locations.
- [ ] Use a second staff account; its sandbox is separate. Sandbox clear does not remove live jobs.
- [ ] Live scheduler panel reflects actual production counts; its scheduler action uses the real queue.

## 7. Real-time, recovery and persistence

- [ ] Keep separate customer and operator sessions open. Observe created/assigned/started/progress/printed/QC/completed/failed state changes.
- [ ] Member A does not receive member B's order/job events or global staff snapshots.
- [ ] Disconnect/reconnect a browser; verify authoritative state refresh, connection indicator and manual refresh behavior.
- [ ] Restart the backend with QUEUED, ASSIGNED, PRINTING, PRINTED and active QC records. Verify reconstruction and retained active stages.
- [ ] Confirm original uploaded files survive restart/redeployment through GridFS.
- [ ] Interrupt Atlas connectivity: health becomes unavailable. Restore access: reconstruction should resume before scheduling proceeds.
- [ ] Do not run two scheduler servers against the same database; pause operator mutations during deployment.

## 8. Render and presentation

- [ ] Deploy one service using the documented commands and backend variables. Supply no frontend environment variables.
- [ ] Verify HTTPS cookie sessions, health, API responses, route refreshes and same-host Socket.IO.
- [ ] Assess behavior after a Free-service cold start; do not treat a wake delay as a scheduler completion time.
- [ ] Check desktop/mobile layouts, keyboard controls, loading/error/empty states, and long names/references.
- [ ] Record observations honestly in the project report; include date, Node version, browser, dataset and any defects. Do not replace unexecuted checks with assumed passes.

## Printing tool redesign and Python integration

- [ ] No pricing navigation, page, admin editor, monetary total or checkout appears. `/api/pricing` and its old subroutes return JSON 404.
- [ ] `/print/preview` is called under `/api`, returns counts for owned documents and rejects invalid page ranges.
- [ ] Five selected pages, duplex, two copies gives six sheets and ten impressions. Overlapping ranges count pages once.
- [ ] Submission recalculates `printSummary` from the document and config; undocumented fields such as a client-supplied sheet count are rejected.
- [ ] New request details show sheets; an older request without `printSummary` still opens.
- [ ] `/requests` and detail links work. Existing `/orders` links redirect, and `/services` redirects to `/guide`.
- [ ] Check Y2K/Memphis layouts at 320 px, tablet and desktop widths: navigation, forms, tables, station controls and DSA diagrams remain usable.
- [ ] Keyboard focus, menu toggling, reduced motion, loading, empty/error states and actual socket connection indicators work.
- [ ] `npm run check:python` finds Python 3.10+ and starts/stops the private worker without MongoDB access.
- [ ] Live queues and the sandbox use the Python classes; no JavaScript DSA implementation remains in `backend/src/dsa`.
- [ ] Worker failure marks health unready and subsequent recovery restores persisted print/QC state without repeating physical printing.
