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
      value={selectedId}
      onChange={(e) =>
        router.push(
          e.target.value === MANAGE
            ? "/settings#semesters"
            : `${basePath}?semester=${e.target.value}`,
        )
      }
      className="rounded-lg border border-brand-ink/20 bg-white px-3 py-1.5 text-sm text-brand-ink shadow-sm outline-none transition-colors focus:border-brand-primary"
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
