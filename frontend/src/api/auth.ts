import { apiFetch, ensureOk } from "@/api/client";
import type { AuthConfig, UserInfo } from "@/types";

export async function fetchOverrideFonts() {
  const res = await ensureOk(await apiFetch("/api/health", { skipAuth: true }));
  const data = (await res.json()) as { override_fonts: string[] };
  return data.override_fonts;
}

export async function fetchAuthConfig() {
  const res = await ensureOk(
    await apiFetch("/api/auth/config", { skipAuth: true }),
  );
  return (await res.json()) as AuthConfig;
}

export async function fetchCurrentUser() {
  const res = await ensureOk(await apiFetch("/api/auth/me"));
  return (await res.json()) as UserInfo;
}

export async function devLogin(
  email: string,
  name: string,
  captchaToken?: string | null,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (captchaToken) {
    headers["X-Captcha-Token"] = captchaToken;
  }
  const res = await ensureOk(
    await apiFetch("/api/auth/dev-login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, name }),
      skipAuth: true,
    }),
  );
  return (await res.json()) as { token: string; user: UserInfo };
}
