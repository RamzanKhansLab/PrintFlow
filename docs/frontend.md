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
| `src/services/api.js`           | Relative HTTP calls, JSON/form bodies, shared errors, date formatting     |
| `src/hooks/useResource.js`      | Cancellable REST reads, reloads, pagination envelope, live invalidation   |
| `src/components/ui.jsx`         | Buttons, fields, errors, badges, headings, loading and empty states       |
| `src/pages/PublicPages.jsx`     | Tool launchpad, field guide and not-found page                            |
| `src/pages/AuthPages.jsx`       | Authentication and read-only account view                                 |
| `src/pages/PrintPage.jsx`       | Upload/select document, configure, preview paper usage and submit         |
| `src/pages/OrderPages.jsx`      | History, detail and private reference tracking                            |
| `src/pages/WorkspacePages.jsx`  | Dashboard, queues, printers, stations and jobs                            |
| `src/pages/ManagementPages.jsx` | Inventory, roles and audit                                                |
| `src/pages/DsaPage.jsx`         | Backend queue operations and production scheduler visualization           |
| `src/styles/main.css`           | Responsive theme, layouts, queue visuals and controls                     |

## Navigation and access

Public routes are `/`, `/guide`, `/login`, `/register`. Print/request/account/track routes require a session. Staff can open `/admin/*` and `/station/:printerId`. Users and audit routes require admin.

Route guards redirect unsigned users to login and preserve the requested path. Backend role/ownership checks remain authoritative. A member cannot gain staff API access by changing a browser route or client state.

## Data flow

`PrintPage` uploads a real file or selects one of the most recent 100 uploads. Configuration changes clear the old paper preview and debounce `/api/print/preview` by 350 ms. The submit button stays disabled until a matching preview is ready. Submission sends document ID, instructions, optional deadline and a stable UUID to `/api/orders`; the backend recomputes paper requirements. No price or payment state is used.

Browser history/detail routes are `/requests` and `/requests/:id`. Old `/orders` links redirect to them, and `/services` redirects to `/guide`. Database/API names remain compatible. The stored `customer` role is displayed as member.

Lists use the API's pagination envelope. `useResource` cancels obsolete requests, clears data when a route's resource path changes and retains existing data during live refresh. Display components distinguish loading, empty and error states. Mutation controls show server error messages and disable repeated in-flight clicks.

The socket provider starts only for authenticated users, disconnects when identity/role changes, and listens for persisted change events. Events trigger debounced REST reloads; a fresh connection triggers a reload to recover missed state. A 60-second session lookup refreshes role/session state and reconnects an available session. Connection status is shown in the shared shell, and the request page explains when live updates are offline.

## Styling and accessibility

The interface uses a Y2K/Memphis theme: chrome gradients, digital typography, grid textures, bold borders and lilac/lime/cyan/peach surfaces, responsive layouts, system fonts and local SVG branding. It includes labeled form controls, keyboard focus outlines, a skip link, error announcements, progress elements and reduced-motion support. Tables/queue visualizations scroll horizontally on narrow screens, and the workspace sidebar becomes a horizontal navigation bar. These are implemented affordances, not a claim of completed accessibility/browser verification.

The launchpad contains task shortcuts, account-scoped recent requests, and staff-only live activity counts. The chrome printer illustration, geometric stars, squiggle and paper-ticket barcode are decorative. Dashboard metrics come from the scheduler snapshot. The DSA sandbox is explicitly labeled and separated from production counts.

## Development and build

`vite.config.js` proxies `/api` and `/socket.io` to localhost:5000. `npm run dev:frontend` serves on localhost:5173 with a fixed port. `npm run build` compiles to `frontend/dist`; Express serves that directory in the complete application. Vite preview alone is not a complete app server.

No external fonts, frontend secret, Vercel configuration, or separate production API base URL is required. Tests and browser verification remain unexecuted at the owner's request.
