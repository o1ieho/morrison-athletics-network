"use client";

/** A submit button that asks before a destructive action. */
export function ConfirmButton({ message, children, className = "button danger" }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
