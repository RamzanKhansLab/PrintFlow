import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    try {
      setUser((await api("/auth/me")).data);
      setError("");
    } catch (failure) {
      setUser(null);
      setError(failure.status === 401 ? "" : failure.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function signIn(mode, input) {
    const result = await api(`/auth/${mode}`, { method: "POST", body: input });
    setUser(result.data);
    setError("");
    return result.data;
  }
  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, error, signIn, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
