"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            TexasTurf OS
          </h1>
          <p className="text-sm text-zinc-600">
            Sign in with your @texasturfusa.com email.
          </p>
        </div>

        {state.status === "sent" ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Magic link sent to <strong>{state.email}</strong>. Check your inbox.
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@texasturfusa.com"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </label>

            {state.status === "error" && (
              <p className="text-sm text-red-600">{state.message}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="block w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}

        <p className="text-xs text-zinc-500">
          Google SSO is coming once we finish setting up OAuth. Until then,
          we&apos;ll email you a one-click sign-in link.
        </p>
      </div>
    </main>
  );
}
