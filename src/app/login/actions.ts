"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid email." };
  }

  // Restrict to the TexasTurf workspace until SSO is wired.
  if (!email.toLowerCase().endsWith("@texasturfusa.com")) {
    return {
      status: "error",
      message: "Only @texasturfusa.com emails can sign in.",
    };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "sent", email };
}

// ─── Email OTP code ───────────────────────────────────────────────────────────
// The installed PWA (iPhone home screen) has a cookie jar separate from Safari,
// so a tapped magic link signs in Safari — not the app. Typing the emailed
// 6-digit code verifies inside the app itself. The same email carries both.

export type VerifyOtpState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function verifyEmailOtp(
  _prev: VerifyOtpState,
  formData: FormData,
): Promise<VerifyOtpState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken.replace(/\D/g, "") : "";

  if (!email.endsWith("@texasturfusa.com")) {
    return {
      status: "error",
      message: "Only @texasturfusa.com emails can sign in.",
    };
  }

  if (token.length !== 6) {
    return { status: "error", message: "Enter the 6-digit code from the email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return {
      status: "error",
      message:
        "That code did not work — it may be expired or already used. Start over to get a new one.",
    };
  }

  // Same landing as the magic-link callback: root routes new users to
  // onboarding and everyone else to the dashboard.
  redirect("/");
}

// ─── Google SSO ───────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes:
        "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        hd: "texasturfusa.com",
      },
    },
  });

  if (error || !data?.url) {
    return { error: error?.message ?? "Could not start Google sign-in." };
  }
  return { url: data.url };
}
