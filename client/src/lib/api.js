import { auth } from "../firebase";

export const API = import.meta.env.PROD
  ? "https://lets-chat-api.onrender.com"
  : "http://localhost:3001";

export async function request(path, opts = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error("Your session has expired. Please sign in.");
  const response = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(json.error || `Request failed (${response.status})`);
  return json;
}
