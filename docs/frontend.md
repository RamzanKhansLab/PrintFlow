# Frontend

The frontend is a React/Vite single-page application. It has no runtime or build-time API/socket environment variables. It uses relative `/api` requests and `io()` with the current origin.

## Structure

| File / directory                | Responsibility                                                            |
| ------------------------------- | ------------------------------------------------------------------------- |
| `src/main.jsx`                  | React root, error boundary, router and providers                          |
| `src/App.jsx`                   | Browser route tree and nested authorization groups                        |
| `src/layouts/Layout.jsx`        | Public shell, staff workspace sidebar, route guards                       |
| `src/store/AuthContext.jsx`     | Cookie-session lookup, login/register/logout, expiry handling             |
| `src/store/RealtimeContext.jsx` | Authenticated socket lifecycle, connection status and change invalidation |
| `src/services/api.js`           | Relative HTTP calls, JSON/form bodies, shared errors, date/money display  |
| `src/hooks/useResource.js`      | Cancellable REST reads, reloads, pagination envelope, live invalidation   |
| `src/components/ui.jsx`         | Buttons, fields, errors, badges, headings, loading and empty states       |
| `src/pages/PublicPages.jsx`     | Home, services, database-backed pricing and not-found page                |
| `src/pages/AuthPages.jsx`       | Authentication and read-only account view                                 |
| `src/pages/PrintPage.jsx`       | Upload/select document, configure, quote and submit                       |
| `src/pages/OrderPages.jsx`      | History, detail and private reference tracking                            |
| `src/pages/WorkspacePages.jsx`  | Dashboard, queues, printers, stations and jobs                            |
| `src/pages/ManagementPages.jsx` | Inventory, pricing administration, roles and audit                        |
| `src/pages/DsaPage.jsx`         | Backend queue operations and production scheduler visualization           |
| `src/styles/main.css`           | Responsive theme, layouts, queue visuals and controls                     |

## Navigation and access

Public routes are `/`, `/services`, `/pricing`, `/login`, `/register`. Print/order/account/track routes require a session. Staff can open `/admin/*` and `/station/:printerId`. The pricing editor, users and audit routes require admin.

Route guards redirect unsigned users to login and preserve the requested path. Backend role/ownership checks remain authoritative. A customer cannot gain staff API access by changing a browser route or client state.

## Data flow

`PrintPage` uploads a real file or selects one of the most recent 100 uploads. Configuration changes clear the old quote and debounce a new backend request by 350 ms. The order button remains disabled until a matching quote is ready. The request carries the server quote total and a stable UUID submission key. The backend recalculates everything.

Lists use the API's pagination envelope. `useResource` cancels obsolete requests, clears data when a route's resource path changes and retains existing data during live refresh. Display components distinguish loading, empty and error states. Mutation controls show server error messages and disable repeated in-flight clicks.

The socket provider starts only for authenticated users, disconnects when identity/role changes, and listens for persisted change events. Events trigger debounced REST reloads; a fresh connection triggers a reload to recover missed state. A 60-second session lookup refreshes role/session state and reconnects an available session. Connection status is shown in the staff shell, and the order page explains when live updates are offline.

## Styling and accessibility

The interface uses a restrained green/cream theme, responsive layouts, system fonts and local SVG branding. It includes labeled form controls, keyboard focus outlines, a skip link, error announcements, progress elements and reduced-motion support. Tables/queue visualizations scroll horizontally on narrow screens, and the workspace sidebar becomes a horizontal navigation bar. These are implemented affordances, not a claim of completed accessibility/browser verification.

The home artwork is a workflow illustration, not a fabricated order or live status display. Dashboard metrics come from the scheduler snapshot. The DSA sandbox is explicitly labeled and separated from production counts.

## Development and build

`vite.config.js` proxies `/api` and `/socket.io` to localhost:5000. `npm run dev:frontend` serves on localhost:5173 with a fixed port. `npm run build` compiles to `frontend/dist`; Express serves that directory in the complete application. Vite preview alone is not a complete app server.

No external fonts, frontend secret, Vercel configuration, or separate production API base URL is required. Tests and browser verification remain unexecuted at the owner's request.
