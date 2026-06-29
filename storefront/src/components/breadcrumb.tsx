import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-ink-400" aria-label="مسار التنقل">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-blue-600">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
          {i < items.length - 1 && <ChevronLeft className="h-3.5 w-3.5" />}
        </span>
      ))}
    </nav>
  );
}
