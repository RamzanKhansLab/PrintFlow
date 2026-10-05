import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { Badge, ErrorNotice, Field, Heading } from "../components/ui";

export function AuthPage({ register = false }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const user = await signIn(register ? "register" : "login", fields);
      const target = location.state?.from;
      navigate(
        target?.startsWith("/") && !target.startsWith("//")
          ? target
          : user.role === "customer"
            ? "/orders"
            : "/admin",
        { replace: true },
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-aside">
        <span className="eyebrow">Welcome to PrintFlow</span>
        <h1>
          Your ideas deserve
          <br />
          <em>a great finish.</em>
        </h1>
        <p>One place to upload, configure, and follow every print.</p>
        <div className="auth-symbol">
          <LockKeyhole size={54} strokeWidth={1} />
        </div>
        <span className="muted">
          Your documents stay connected to your account.
        </span>
      </section>
      <section className="auth-form">
        <Heading
          eyebrow={register ? "Let’s get started" : "Good to see you"}
          title={register ? "Create your account" : "Welcome back"}
        >
          {register
            ? "Your next print starts here."
            : "Sign in to pick up where you left off."}
        </Heading>
        <ErrorNotice>{error}</ErrorNotice>
        <form onSubmit={submit} className="form-stack">
          {register && (
            <Field label="Full name">
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
          <Field
            label="Password"
            hint="10–72 characters; at most 72 UTF-8 bytes."
          >
            <input
              type="password"
              name="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={10}
              maxLength={72}
            />
          </Field>
          <button className="button" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="muted">
          {register ? "Already have an account?" : "New to PrintFlow?"}{" "}
          <Link to={register ? "/login" : "/register"} state={location.state}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </div>
  );
}
export function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="container narrow section">
      <Heading eyebrow="Your PrintFlow" title="Account" />
      <div className="card">
        <div className="account-avatar">{user.name.slice(0, 1)}</div>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <Badge status={user.role} />
        <p className="muted">
          Contact your print desk administrator if you need operator access.
        </p>
        <Link className="button secondary" to="/orders">
          View your orders
        </Link>
      </div>
    </div>
  );
}
