import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ withWordmark = true, className }: { withWordmark?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="أوفيرا">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-blue">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 11-7.2"
            stroke="white"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <rect x="20.5" y="11" width="8.5" height="2.4" rx="1.2" fill="white" />
          <rect x="20.5" y="14.8" width="8.5" height="2.4" rx="1.2" fill="white" />
          <rect x="20.5" y="18.6" width="8.5" height="2.4" rx="1.2" fill="white" />
        </svg>
      </span>
      {withWordmark && <span className="text-xl font-medium tracking-tight text-ink">أوفيرا</span>}
    </Link>
  );
}
