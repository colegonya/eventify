"use client";

import { useRouter } from "next/navigation";

export function SemesterSwitcher({
  semesters,
  selectedId,
  basePath = "/calendar",
}) {
  const router = useRouter();

  // Adding a semester is rare enough not to earn its own button on every page,
  // but the switcher is where you go looking for one — so it's an option here.
  const MANAGE = "__manage__";

  return (
    <select
      aria-label="Select semester"
      value={selectedId ?? ""}
      onChange={(e) =>
        router.push(
          e.target.value === MANAGE
            ? "/settings#semesters"
            : `${basePath}?semester=${e.target.value}`,
        )
      }
      className="rounded-sm border border-brand-ink/25 bg-background px-3 py-1.5 text-sm font-medium text-brand-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
    >
      {semesters.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
      <option value={MANAGE}>Add or edit semesters…</option>
    </select>
  );
}
