"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/app/(staff)/admin/actions";

type Action = (state: ActionResult, form: FormData) => Promise<ActionResult>;

/** A form bound to a server action, showing its success or error message. */
export function AdminForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
}: {
  action: Action;
  submitLabel: string;
  children: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      className="form"
      action={formAction}
      key={resetOnSuccess ? (state.at ?? 0) : undefined}
    >
      {children}
      {state.error && <div className="notice error">{state.error}</div>}
      {state.ok && <div className="notice">{state.ok}</div>}
      <div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
