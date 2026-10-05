# Setup

## Prerequisites

- Node.js 22.x, version 22.12.0 or newer, with npm. `.nvmrc` and package engines specify this line.
- Python 3.10+ on PATH (`python` on Windows, `python3` on Linux/macOS). Only the standard library is used; no pip install is needed.
- MongoDB Atlas, or a MongoDB replica set. Transactions are used for orders, job transitions, inventory and audit records. A standalone local MongoDB daemon is not sufficient.
- Access to this repository from a terminal. Git is needed for later deployment.

## MongoDB Atlas

1. Create an Atlas project and cluster suitable for a college demonstration.
2. Create a database user with `readWrite` access to the `printflow` database.
3. Add your current machine's IP to Network Access. Add the Render service's outbound IP ranges when deploying.
4. Choose Connect → Drivers → Node.js and copy the connection URI. Insert your credentials and database name, e.g. `mongodb+srv://USER:PASSWORD@HOST/printflow?retryWrites=true&w=majority`. Percent-encode reserved characters in the username/password.
5. The application creates its collections and indexes at startup. GridFS collections appear after an upload. No SQL migration or manual queue JSON is needed.

## Installation and backend settings

From the repository root:

```powershell
npm.cmd ci
Copy-Item backend/.env.example backend/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the generated secret into `backend/.env`. The file is loaded relative to `backend/src/config/env.js`, so the working directory does not change its location. Already-set process environment values take precedence.

| Variable      | Purpose                                   | Local value / default                                                |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `MONGODB_URI` | MongoDB connection URI                    | Required, including a database name                                  |
| `JWT_SECRET`  | HS256 signing secret                      | Required; 32+ random characters; the example placeholder is rejected |
| `NODE_ENV`    | Secure-cookie/proxy/static-build behavior | `development` by default; `production` on Render                     |
| `PORT`        | Express + Socket.IO HTTP listener         | `5000` locally                                                       |

No `COOKIE_SECRET`, Cloudinary, Razorpay, Redis, or frontend environment variables are used. Uploads use GridFS and payment is outside the app. Never commit the actual `.env`.

## Development

```powershell
npm.cmd run dev
```

This starts the backend watcher and Vite together. Node automatically starts the local Python DSA worker; do not start another Python server. Restart the backend after changing Python files because Node watch mode only follows the JavaScript dependency tree. Open `http://localhost:5173`. The development proxy forwards both `/api` and `/socket.io` to `http://localhost:5000`, retaining the browser-facing host. There is no cross-origin browser API call and no CORS allowlist to maintain.

Separate-terminal alternative:

```powershell
npm.cmd run dev:backend
```

```powershell
npm.cmd run dev:frontend
```

Use the default backend port 5000 with the provided Vite proxy. If changing the local port, edit both `backend/.env` and the two proxy targets in `frontend/vite.config.js`. No frontend env file is required.

## First administrator and print desk

1. Register a normal account at `/register`. Public registration always creates a customer; submitting a `role` field is rejected.
2. Run `npm.cmd run admin -- your-email@example.com` against the same database. This promotes an existing account; it does not create a password or seed a shared account.
3. Sign out and back in. Open `/admin/printers` and add your printer's real supported capabilities. New printers are offline until explicitly switched online.
4. In `/admin/inventory`, add the paper actually available. Starting a print with insufficient stock returns 409 without changing the job or stock.
5. Review editable defaults in `/admin/pricing`. Prices are INR: base ₹2/page, color 5×, A4/Letter 1×, A3 2×, duplex 1×, staple ₹5/copy, spiral ₹40/copy, rush 1.5×, tax 0%. These are starter rules, not a claim about market rates.
6. Other users register normally. An admin can assign `operator` or `admin` through `/admin/users`. Self-demotion through that API is disabled.

## Built application on a single local origin

```powershell
npm.cmd run build
npm.cmd start
```

Open `http://localhost:5000`. `npm run build` checks the Python worker imports, then creates `frontend/dist`; `npm start` starts Express and its Python worker. Express serves that exact build directory. Neither backend JavaScript nor Python needs a separate compilation step. For local HTTP keep `NODE_ENV=development` even when serving built assets. `NODE_ENV=production` sets a Secure cookie and assumes HTTPS behind Render's proxy.

Do not use `vite preview` as the complete application: it only previews static frontend files and does not supply the API/Socket.IO production server. Use Express to check the complete built application.

## Commands

| Command                  | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `npm ci`                 | Reproduce root and workspace dependencies from the lockfile |
| `npm install`            | Install/update dependencies during development              |
| `npm run dev`            | Both development servers                                    |
| `npm run dev:backend`    | Backend watcher                                             |
| `npm run dev:frontend`   | Vite server                                                 |
| `npm run build`          | Build React into `frontend/dist`                            |
| `npm start`              | Start the backend and serve any built SPA                   |
| `npm run admin -- EMAIL` | Promote an existing account                                 |

In PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`. Runtime verification is left to the owner; see [acceptance](acceptance.md).
