"use client";

import { useActionState } from "react";
import {
  sendMagicLink,
  verifyEmailOtp,
  type LoginState,
  type VerifyOtpState,
} from "./actions";
import { GoogleSignInButton } from "./google-button";

const initialState: LoginState = { status: "idle" };
const verifyInitialState: VerifyOtpState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      {/* Atmosphere — soft turf glow + faint grid, pure CSS */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[-14%] h-[440px] w-[860px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, var(--color-brand-tint), transparent 72%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-ink) 1px, transparent 1px), linear-gradient(90deg, var(--color-ink) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            WebkitMaskImage: "radial-gradient(68% 52% at 50% 32%, #000, transparent)",
            maskImage: "radial-gradient(68% 52% at 50% 32%, #000, transparent)",
          }}
        />
      </div>

      <div className="reveal relative w-full max-w-[400px]">
        {/* Brand lockup */}
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="display mt-4 text-2xl text-ink">TexasTurf OS</h1>
          <p className="mt-1.5 text-sm text-ink-3">The operations command center.</p>
        </div>

        <div className="card p-6 sm:p-7" style={{ boxShadow: "var(--shadow-pop)" }}>
          {state.status === "sent" ? (
            <VerifyCodeForm email={state.email} />
          ) : (
            <div className="space-y-4">
              <GoogleSignInButton />

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="eyebrow">or email</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <form action={formAction} className="space-y-3">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-ink-2">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@texasturfusa.com"
                    className="field-input"
                  />
                </div>

                {state.status === "error" && (
                  <p className="text-sm text-danger">{state.message}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="btn btn-primary h-11 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Send sign-in email"}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-4">
          Restricted to @texasturfusa.com accounts.
        </p>
      </div>
    </main>
  );
}

function VerifyCodeForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    verifyEmailOtp,
    verifyInitialState,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-line bg-brand-tint p-4 text-sm">
        <p className="font-semibold text-brand-strong">Check your inbox.</p>
        <p className="mt-1 text-brand">
          We sent a sign-in link and a 6-digit code to <strong>{email}</strong>.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <div>
          <label htmlFor="token" className="mb-1.5 block text-xs font-semibold text-ink-2">
            6-digit code
          </label>
          <input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="000000"
            className="field-input text-center text-lg tracking-[0.4em]"
          />
        </div>

        {state.status === "error" && (
          <p className="text-sm text-danger">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary h-11 w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Verify code"}
        </button>
      </form>

      <p className="text-center text-xs text-ink-4">
        On a computer? You can click the sign-in link in the email instead.{" "}
        <a href="/login" className="font-semibold text-ink-2 underline">
          Start over
        </a>
      </p>
    </div>
  );
}

function BrandMark() {
  return (
    <span
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
      style={{
        background: "linear-gradient(180deg, var(--color-brand-hi), var(--color-brand))",
        boxShadow: "var(--shadow-e2), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <path d="M12 20V8" />
          <path d="M12 19c0-4 2.6-6.2 5-7.4" />
          <path d="M12 19c0-4-2.6-6.2-5-7.4" />
        </g>
      </svg>
    </span>
  );
}
