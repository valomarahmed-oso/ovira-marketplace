import Link from "next/link";
import { icons, Tag } from "lucide-react";
import type { Category } from "@/lib/api";

function iconFor(name?: string) {
  if (!name) return Tag;
  const pascal = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return (icons as Record<string, typeof Tag>)[pascal] ?? Tag;
}

export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {categories.map((c) => {
        const Icon = iconFor(c.icon);
        return (
          <Link
            key={c.name}
            href={`/category/${c.slug}`}
            className="group flex w-24 shrink-0 flex-col items-center gap-2"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface transition-colors group-hover:border-blue group-hover:bg-blue-50">
              <Icon className="h-6 w-6 text-blue-600" />
            </span>
            <span className="text-center text-xs leading-tight text-ink">{c.category_name}</span>
          </Link>
        );
      })}
    </div>
  );
}
