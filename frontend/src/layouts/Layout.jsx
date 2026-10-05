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
  Settings,
  Users,
  X,
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
    return <Navigate to="/orders" replace />;
  return <Outlet />;
}
export function Layout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
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
            <NavLink to="/services">Services</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/track">Track order</NavLink>
            {user ? (
              <>
                <NavLink to="/orders">My orders</NavLink>
                {user.role !== "customer" && (
                  <NavLink to="/admin">Workspace</NavLink>
                )}
                <NavLink to="/account" className="avatar" title="Your account">
                  {user.name.slice(0, 1)}
                </NavLink>
                <button
                  className="icon-button"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={() => signOut().catch(() => {})}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <NavLink to="/login">Sign in</NavLink>
            )}
            <Link to="/print" className="button small">
              Start a print
            </Link>
          </nav>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <Brand />
        <p>Smart printing. Thoughtfully queued.</p>
        <span>BE · Semester 5 · DSA mini project</span>
      </footer>
    </>
  );
}
const staffLinks = [
  ["dashboard", "Overview", Gauge],
  ["queue", "Live queue", Layers],
  ["printers", "Printers", Printer],
  ["jobs", "Print jobs", ClipboardList],
  ["inventory", "Paper inventory", Boxes],
  ["dsa", "DSA lab", BookOpen],
];
export function AdminLayout() {
  const { user } = useAuth();
  const { status } = useRealtime();
  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="eyebrow">Print workspace</div>
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
              <NavLink to="/admin/pricing">
                <Settings size={18} />
                Pricing rules
              </NavLink>
              <NavLink to="/admin/users">
                <Users size={18} />
                People
              </NavLink>
              <NavLink to="/admin/audit">
                <Activity size={18} />
                Activity log
              </NavLink>
            </>
          )}
        </nav>
        <div className="connection">
          <span className={`connection-dot ${status}`} />
          {status === "connected"
            ? "Live updates connected"
            : status === "connecting"
              ? "Connecting…"
              : "Updates offline — refresh to sync"}
        </div>
        <p className="sidebar-note">
          A little structure.
          <br />A smoother workflow.
        </p>
      </aside>
      <div className="workspace-main">
        <Outlet />
      </div>
    </div>
  );
}
