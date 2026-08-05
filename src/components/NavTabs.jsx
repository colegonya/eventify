"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/calendar", label: "Calendar" },
  { href: "/budget", label: "Budget" },
  { href: "/categories", label: "Categories" },
  { href: "/drinks", label: "Drinks" },
  { href: "/contacts", label: "Contacts" },
  { href: "/settings", label: "Settings" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0 overflow-x-auto px-1 sm:gap-1 sm:px-4 md:px-6">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-1 py-2.5 text-[11px] font-semibold tracking-wide uppercase transition-colors sm:px-3 sm:text-[13px] ${
              active
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-ink/70 hover:text-brand-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
