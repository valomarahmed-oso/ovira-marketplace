"use client";

import Link from "next/link";
import { CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "@/components/logo";
import { useI18n } from "@/components/i18n-provider";
import { useAppConfig } from "@/components/app-config-provider";

export function Footer() {
  const { t } = useI18n();
  const { multiVendor } = useAppConfig();

  const trust = [
    { icon: Truck, label: t.freeShipping, note: t.freeShippingNote, href: "/products" },
    { icon: ShieldCheck, label: t.securePayment, note: t.securePaymentNote, href: "/products" },
    { icon: RotateCcw, label: t.easyReturns, note: t.easyReturnsNote, href: "/products" },
    { icon: CreditCard, label: t.codPayment, note: t.codNote, href: "/products" },
  ];

  const columns = [
    {
      title: t.footShop,
      links: [
        { label: t.allCategories, href: "/categories" },
        { label: t.deals, href: "/products?sort=price_asc" },
        { label: t.bestSellers, href: "/products" },
        { label: t.newArrivals, href: "/products" },
      ],
    },
    {
      title: t.footAccount,
      links: [
        { label: t.footTrackOrder, href: "/account/orders" },
        { label: t.wishlist, href: "/wishlist" },
        { label: t.footReturns, href: "/account/orders" },
        { label: t.footHelp, href: "/account" },
      ],
    },
    ...(multiVendor
      ? [
          {
            title: t.footVendors,
            links: [
              { label: t.becomeVendor, href: "/sell" },
              { label: t.footVendorDashboard, href: "/vendor" },
              { label: t.footSellingPolicy, href: "/sell" },
              { label: t.footCommissions, href: "/sell" },
            ],
          },
        ]
      : []),
    {
      title: t.footOvira,
      links: [
        { label: t.footAbout, href: "#" },
        { label: t.footCareers, href: "#" },
        { label: t.footTerms, href: "#" },
        { label: t.footPrivacy, href: "#" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-ovira grid grid-cols-2 gap-4 py-8 md:grid-cols-4">
        {trust.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50">
              <item.icon className="h-5 w-5 text-blue-600" />
            </span>
            <div>
              <div className="text-sm font-medium text-ink">{item.label}</div>
              <div className="text-xs text-ink-400">{item.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="container-ovira grid grid-cols-2 gap-8 py-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-ink-400">{t.footerAbout}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-medium text-ink">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-ink-400 transition-colors hover:text-blue-600">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-ovira flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-400 md:flex-row">
          <span>© {new Date().getFullYear()} {t.brand} — {t.rights}</span>
          <span className="font-tech">{t.builtOn}</span>
        </div>
      </div>
    </footer>
  );
}
