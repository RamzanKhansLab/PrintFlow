export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body && !isForm
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    body: options.body && !isForm ? JSON.stringify(options.body) : options.body,
  });
  const payload = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response" }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}
export const date = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No deadline";
