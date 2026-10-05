import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { useRealtime } from "../store/RealtimeContext";

export function useResource(path, live = true) {
  const { revision } = useRealtime();
  const [counter, setCounter] = useState(0);
  const [state, setState] = useState({
    path: null,
    data: null,
    pagination: null,
    loading: true,
    error: "",
  });
  const reload = useCallback(() => setCounter((value) => value + 1), []);
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState((value) =>
      value.path === path
        ? { ...value, error: "", loading: !value.data }
        : { path, data: null, pagination: null, error: "", loading: true },
    );
    api(path, { signal: controller.signal })
      .then((result) =>
        setState({ ...result, path, loading: false, error: "" }),
      )
      .catch((error) => {
        if (error.name !== "AbortError")
          setState((value) => ({
            ...value,
            loading: false,
            error: error.message,
          }));
      });
    return () => controller.abort();
  }, [path, counter, live ? revision : 0]);
  return {
    ...(state.path === path
      ? state
      : { data: null, pagination: null, error: "", loading: Boolean(path) }),
    reload,
  };
}
