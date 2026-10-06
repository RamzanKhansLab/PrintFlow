# One application on Render

The deployment is one Node Web Service: Express serves `/api/*`, Socket.IO, and `frontend/dist`, and starts one local Python worker for all DSA operations. MongoDB Atlas holds records and document bytes. The frontend needs **zero environment variables**, and no separate frontend or Python hosting is involved.

## Deploy procedure

1. **Push to GitHub.** Commit the source, root `package-lock.json`, and `render.yaml`. Do not commit `backend/.env`, `node_modules`, or generated `frontend/dist`.
2. **Create the database.** Set up MongoDB Atlas as described in [setup](setup.md). Use a named database and database user, and authorize the Render service's outbound IP ranges in Atlas Network Access.
3. **Create the service.** In Render choose New → Web Service and connect the GitHub repository. Select the branch containing PrintFlow. Leave Root Directory empty when this folder is the repository root. If it is a subdirectory in a larger repository, set Root Directory to that relative subdirectory.
4. **Configure the build:** `npm ci --include=dev && npm run build`. The root build checks Python 3.10+ and imports the DSA worker before building React. Explicitly including dev dependencies ensures Vite is available even with `NODE_ENV=production`. Render native runtimes include Python tooling at build and runtime; see [Render's tool list](https://render.com/docs/native-runtimes). No pip dependencies are required.
5. **Configure the start:** `npm start`. Choose Node runtime, a single instance and the Free plan for a college demonstration. Use Node 22 (the package supports 22.12+ in that line).
6. **Set backend environment variables:**

   | Name          | Value                                     |
   | ------------- | ----------------------------------------- |
   | `MONGODB_URI` | Atlas URI including the database name     |
   | `JWT_SECRET`  | A random secret of at least 32 characters |
   | `NODE_ENV`    | `production`                              |

   Do not set frontend API/socket URLs. Render provides `PORT`; the application binds it on `0.0.0.0`. The Blueprint additionally pins the platform runtime via `NODE_VERSION=22`; this is a Render runtime setting, not a frontend setting.

7. **Set Health Check Path** to `/api/health` and deploy. Production startup reports a clear error if `frontend/dist/index.html` is missing. It connects to MongoDB, verifies transaction support, initializes indexes, and restores the scheduler before listening.
8. **Verify health:** open `https://YOUR-SERVICE.onrender.com/api/health`. Expect HTTP 200 with `{"status":"ok"}`. Unavailable database/scheduler state returns 503.
9. **Verify frontend:** open `/` and `/guide`. Refresh a deep link such as `/admin/dsa`; Express must return the SPA, and React then applies authentication. Missing `/api/...` paths must return a JSON 404, not HTML.
10. **Verify API:** register and log in, upload a PDF, preview paper requirements, and submit a print request. In the browser network panel requests must target `/api/...` on the same Render host.
11. **Verify Socket.IO:** use separate customer and staff browser sessions. The staff connection indicator should report connected. A customer should receive their order transitions. Reconnecting reloads data from the API to recover missed events. Socket.IO supports polling and WebSocket transport on this one origin.
12. **Bootstrap the print desk:** follow the first-admin procedure below, create real printer records, bring them online, and restock paper. Complete a print/QC cycle, then inspect `/admin/dsa`.
13. **Verify recovery and DSA:** use the [acceptance checklist](acceptance.md) to check heap ordering, ring wrap-around, FIFO QC, incompatible-printer waiting, failure/reprint behavior, and restart reconstruction. These are instructions for the owner, not completed verification results.

Alternative: create a Render Blueprint from `render.yaml`. It defines the same one-service configuration, asks for `MONGODB_URI`, and generates `JWT_SECRET`. Do not create both a manual service and a Blueprint service against the same database.

## First admin on a Free service

Render Free services do not provide a shell. There is no public bootstrap endpoint or default admin password:

1. Register your intended admin account on the deployed site.
2. On your local machine, configure `backend/.env` with the **same Atlas database** and a valid local `JWT_SECRET` (the CLI uses the database; it does not need to mint a production session). Permit your local IP in Atlas.
3. Run `npm ci`, then `npm run admin -- your-email@example.com` locally. This CLI only changes the existing user's role and records an audit entry. Do not start a second backend scheduler against the deployment database.
4. Sign out of the deployed site and sign back in. Use the workspace to assign future staff roles.

## Persistence and availability

MongoDB records and GridFS document bytes survive a Render filesystem reset. Runtime queues and each user's DSA sandbox live in the Python worker's memory. On Node or Python worker restart, persisted active jobs reconstruct the real queues; the sandbox resets. A recovered `PRINTING` job remains active until an operator records its outcome, avoiding an automatic physical reprint. Worker failure clears scheduler health until Node restarts Python and restores MongoDB state.

Use one backend process and one service for a given database. The promise-based scheduler lock is process-local, not a distributed lock. Pause operator changes during deploys because old and new processes may overlap; active-active scheduling and crash-safe physical printer acknowledgements require future work.

Render describes Free instances as suitable for hobby projects and previews. They sleep after inactivity, take time to wake, have usage limits, and use an ephemeral filesystem. They do not provide always-on production service. See [Render Free service limitations](https://render.com/docs/free).

## Troubleshooting

| Symptom                                                   | What to inspect                                                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| SPA route returns server 404                              | Run the root build; check `frontend/dist/index.html`; start Express, not Vite preview. `/api` routes precede the SPA fallback.                |
| `Missing frontend/dist/index.html`                        | Use `npm ci --include=dev && npm run build` from the correct root directory. No manual file copying is needed.                                |
| MongoDB connection failure                                | Verify database credentials, percent-encoding, DNS/SRV access, Atlas cluster state, and outbound-IP allowlisting.                             |
| Transactions unavailable                                  | Use Atlas or a MongoDB replica set. Standalone local MongoDB is intentionally rejected at startup.                                            |
| Port detection or timeout                                 | Keep `npm start`; allow Render to provide `PORT`; code binds `0.0.0.0`. Database startup failures must be resolved first.                     |
| Socket disconnected                                       | Inspect `/socket.io/` requests and session cookies. Both page and socket must use the same host. Sign in again if the 8-hour session expired. |
| Login works locally but not in a production-mode HTTP run | Production cookies are Secure. Use HTTPS on Render and `NODE_ENV=development` for local HTTP.                                                 |
| Build cannot find Vite                                    | Include dev dependencies in the build install; use the root workspace manifest and committed lockfile.                                        |
| Unsupported Node engine                                   | Set Render's Node version to 22, at least 22.12.                                                                                              |
| Jobs stay queued                                          | Add an online compatible printer with free buffer slots. Check color, duplex, paper size and the station's active job.                        |
| Job will not start                                        | Check online status, buffer head, active job and paper inventory. Status 409 means the transition was not accepted.                           |
| Cold start feels slow                                     | Free services may be waking. Wait for `/api/health` to become healthy before evaluating the app.                                              |
| Health 503 after database interruption                    | Restore Atlas access; recovery retries every 30 seconds and on the next scheduler mutation.                                                   |

Configuration references: [Render Express deployment](https://render.com/docs/deploy-node-express-app), [Blueprint specification](https://render.com/docs/blueprint-spec), and [Vite setup requirements](https://vite.dev/guide/). Hosting account provisioning and deployment have not been performed for this coding-only task.
