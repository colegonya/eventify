"use client";

import { useRouter } from "next/navigation";

export function SemesterSwitcher({
  semesters,
  selectedId,
  basePath = "/calendar",
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Select semester"
      value={selectedId}
      onChange={(e) => router.push(`${basePath}?semester=${e.target.value}`)}
      className="rounded-lg border border-brand-ink/20 bg-white px-3 py-1.5 text-sm text-brand-ink shadow-sm outline-none transition-colors focus:border-brand-primary"
    >
      {semesters.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
