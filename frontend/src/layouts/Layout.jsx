import { NavLink, Link, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Boxes,
  ClipboardList,
  Gauge,
  Layers,
  LogOut,
  Menu,
  Printer,
  Users,
  X,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../store/AuthContext";
import { useRealtime } from "../store/RealtimeContext";
import { Brand, ErrorNotice, Loading } from "../components/ui";

export function RequireAuth({ staff = false, admin = false }) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="container section">
        <ErrorNotice>{error}</ErrorNotice>
        <button className="button secondary" onClick={refresh}>
          Retry connection
        </button>
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (
    (staff && !["admin", "operator"].includes(user.role)) ||
    (admin && user.role !== "admin")
  )
    return <Navigate to="/requests" replace />;
  return <Outlet />;
}

export function ConnectionStatus() {
  const { user } = useAuth();
  const { status } = useRealtime();
  return (
    <span className="connection">
      <span className={`connection-dot ${user ? status : "signed-out"}`} />
      {!user
        ? "SIGN IN TO CONNECT"
        : status === "connected"
          ? "LIVE SYNC CONNECTED"
          : status === "connecting"
            ? "CONNECTING…"
            : "SYNC OFFLINE · REFRESH TO UPDATE"}
    </span>
  );
}

export function Layout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="system-strip">
        <span>PRINTFLOW / SHARED PRINT WORKSPACE</span>
        <ConnectionStatus />
      </div>
      <header className="header">
        <div className="header-inner">
          <Brand />
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            className={`nav ${open ? "open" : ""}`}
            aria-label="Main navigation"
            onClick={() => setOpen(false)}
          >
            <NavLink end to="/">
              Launchpad
            </NavLink>
            <NavLink to="/requests">Requests</NavLink>
            <NavLink to="/track">Track</NavLink>
            <NavLink to="/guide">Field guide</NavLink>
            {user?.role !== "customer" && user && (
              <NavLink to="/admin">Control room</NavLink>
            )}
            {user ? (
              <>
                <NavLink to="/account" className="avatar" title="Your account">
                  {user.name.slice(0, 1)}
                </NavLink>
                <button
                  className="icon-button"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={() => signOut().catch(() => {})}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <NavLink to="/login">Sign in</NavLink>
            )}
            <Link to="/print" className="button small">
              <Plus size={17} />
              New request
            </Link>
          </nav>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <Brand />
        <p>SHOPS / CAMPUSES / OFFICES / EVERY PRINT DESK</p>
        <span>
          BE SEM 05 · DSA LAB <ArrowUpRight size={14} />
        </span>
      </footer>
    </>
  );
}

const staffLinks = [
  ["dashboard", "Overview", Gauge],
  ["queue", "Live queue", Layers],
  ["printers", "Printer stations", Printer],
  ["jobs", "Job history", ClipboardList],
  ["inventory", "Paper inventory", Boxes],
  ["dsa", "Python DSA lab", BookOpen],
];
export function AdminLayout() {
  const { user } = useAuth();
  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading">
          <span className="mini-cross" aria-hidden="true">
            ✳
          </span>
          <span>
            CONTROL
            <br />
            ROOM_
          </span>
        </div>
        <div className="eyebrow">Operator tools</div>
        <nav aria-label="Workspace navigation">
          {staffLinks.map(([path, title, Icon]) => (
            <NavLink key={path} to={`/admin/${path}`}>
              <Icon size={18} />
              {title}
            </NavLink>
          ))}
          {user.role === "admin" && (
            <>
              <div className="nav-divider" />
              <NavLink to="/admin/users">
                <Users size={18} />
                People & access
              </NavLink>
              <NavLink to="/admin/audit">
                <Activity size={18} />
                Activity log
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-sticker">
          <Printer size={24} />
          <span>
            LESS CHAOS.
            <br />
            MORE PAPER.
          </span>
          <span className="sticker-corner" aria-hidden="true">
            ↗
          </span>
        </div>
        <ConnectionStatus />
      </aside>
      <div className="workspace-main">
        <div className="window-bar">
          <span>PRINTFLOW / CONTROL PANEL</span>
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
