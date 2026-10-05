import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const Context = createContext({ revision: 0, status: "offline" });
export function RealtimeProvider({ children }) {
  const { user, refresh } = useAuth();
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("offline");
  useEffect(() => {
    if (!user) {
      setStatus("offline");
      return;
    }
    const socket = io({ withCredentials: true });
    let timer;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setRevision((value) => value + 1), 120);
    };
    setStatus("connecting");
    socket.on("connect", () => {
      setStatus("connected");
      invalidate();
    });
    socket.on("disconnect", (reason) => {
      setStatus("offline");
      if (reason === "io server disconnect") refresh();
    });
    socket.on("connect_error", () => setStatus("offline"));
    socket.onAny((event) => {
      if (event.includes(":")) invalidate();
    });
    // Catch up after reconnects and give role changes/session expiry a fresh check.
    const sessionCheck = setInterval(() => {
      refresh();
      if (!socket.connected) socket.connect();
    }, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(sessionCheck);
      socket.disconnect();
    };
  }, [user?._id, user?.role]);
  return (
    <Context.Provider value={{ revision, status }}>{children}</Context.Provider>
  );
}
export const useRealtime = () => useContext(Context);
