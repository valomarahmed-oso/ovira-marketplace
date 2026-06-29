"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";
import { useI18n } from "@/components/i18n-provider";

export function SectionHeading({ title, href }: { title: string; href?: string }) {
  const { t } = useI18n();
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <OviraBars />
        <h2 className="text-xl font-medium text-ink md:text-2xl">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          {t.viewAll}
          <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
        </Link>
      )}
    </div>
  );
}
