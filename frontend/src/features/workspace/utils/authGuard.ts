import type { UserInfo } from "@/types";

export function isAuthenticatedUser(user: UserInfo | null): boolean {
  return Boolean(
    user &&
      user.provider !== "guest" &&
      user.id !== "guest" &&
      !user.id.startsWith("gst_"),
  );
}

/** True when the current URL points at the dashboard, an editor doc, or any non-root route. */
export function isProtectedUrl(loc: Location = window.location): boolean {
  const params = new URLSearchParams(loc.search);
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  return (
    path !== "/" ||
    params.get("view") === "dashboard" ||
    Boolean(params.get("doc"))
  );
}

export function hasOAuthCallbackParams(loc: Location = window.location): boolean {
  const params = new URLSearchParams(loc.search);
  return Boolean(params.get("userId") && params.get("secret"));
}

export function resetToLandingUrl(): void {
  window.history.replaceState({}, "", "/");
}
