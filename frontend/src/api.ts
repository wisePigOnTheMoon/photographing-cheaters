// Base URL for backend API.
// In dev, leave REACT_APP_API_URL unset and CRA's "proxy" field forwards to localhost:4000.
// In production (Vercel), set REACT_APP_API_URL to your Render backend URL,
// e.g. https://photographing-cheaters-api.onrender.com
const RAW = process.env.REACT_APP_API_URL || "";
export const API_BASE = RAW.replace(/\/$/, "");

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}
