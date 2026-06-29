import Link from "next/link";
import { icons, Tag } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { getCategories } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "كل الأقسام | أوفيرا" };

function iconFor(name?: string) {
  if (!name) return Tag;
  const pascal = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return (icons as Record<string, typeof Tag>)[pascal] ?? Tag;
}

export default async function CategoriesPage() {
  const [categories, locale] = await Promise.all([getCategories(), getLocale()]);
  const t = getDict(locale);

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: t.allCategories }]} />
      <div>
        <h1 className="text-2xl font-medium text-ink md:text-3xl">{t.allCategories}</h1>
        <p className="mt-1 text-sm text-ink-400">{t.allCategoriesSub}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => {
          const Icon = iconFor(c.icon);
          return (
            <Link
              key={c.name}
              href={`/category/${c.slug}`}
              className="card group flex flex-col items-center gap-3 p-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 transition-colors group-hover:bg-blue group-hover:text-white">
                <Icon className="h-7 w-7 text-blue-600 transition-colors group-hover:text-white" />
              </span>
              <span className="text-sm font-medium text-ink">{c.category_name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
