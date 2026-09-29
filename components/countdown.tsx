"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const two = (value: number) => String(value).padStart(2, "0");

/** "Tip-off in 1d 03:12:44", ticking every second; renders nothing until mounted (avoids a server/browser mismatch). */
export function Countdown({ to, label = "Tip-off in" }: { to: string; label?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) return <span className="countdown" aria-hidden="true">&nbsp;</span>;
  const remaining = Date.parse(to) - now;
  if (remaining <= 0) return <span className="countdown">Starting soon</span>;

  const { days, hours, minutes, seconds } = parts(remaining);
  return (
    <span className="countdown" role="timer" aria-label={`${label} ${days} days ${hours} hours ${minutes} minutes`}>
      <span className="countdown-label">{label}</span>
      <span className="countdown-value tabular">
        {days > 0 && `${days}d `}
        {two(hours)}:{two(minutes)}:{two(seconds)}
      </span>
    </span>
  );
}
