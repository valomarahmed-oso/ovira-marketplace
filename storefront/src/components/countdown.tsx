"use client";

import { useEffect, useState } from "react";

/** Parse a Frappe datetime ("YYYY-MM-DD HH:mm:ss", site-local) into a timestamp. */
function parse(ends: string): number {
  const t = Date.parse(ends.includes("T") ? ends : ends.replace(" ", "T"));
  return Number.isNaN(t) ? 0 : t;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Ticking time-remaining until `endsOn`. Calls `onExpire` once it hits zero. */
export function Countdown({
  endsOn,
  className = "",
  onExpire,
}: {
  endsOn: string;
  className?: string;
  onExpire?: () => void;
}) {
  const target = parse(endsOn);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, target - now);
  useEffect(() => {
    if (target && remaining <= 0) onExpire?.();
  }, [remaining, target, onExpire]);

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const cell =
    "inline-grid min-w-[1.75rem] place-items-center rounded-md bg-ink px-1 py-0.5 font-tech text-xs text-white";

  return (
    <div className={`flex items-center gap-1 ${className}`} dir="ltr" aria-label="الوقت المتبقي">
      {days > 0 && (
        <>
          <span className={cell}>{days}ي</span>
          <span className="text-ink-400">:</span>
        </>
      )}
      <span className={cell}>{pad(hours)}</span>
      <span className="text-ink-400">:</span>
      <span className={cell}>{pad(mins)}</span>
      <span className="text-ink-400">:</span>
      <span className={cell}>{pad(secs)}</span>
    </div>
  );
}
