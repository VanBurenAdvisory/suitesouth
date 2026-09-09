"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/app/actions";

const INITIAL: FormState = { ok: false, error: null, savedAt: 0 };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Suite South</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the shared password to continue.</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Checking..." : "Sign in"}
      </button>
    </form>
  );
}
