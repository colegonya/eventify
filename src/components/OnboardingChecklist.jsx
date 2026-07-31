import Link from "next/link";
import { dismissOnboardingChecklistAction } from "@/lib/actions";

const ITEMS = [
  { label: "Set your chapter's colors", href: "/settings#chapter" },
  { label: "Review your event categories", href: "/categories" },
  { label: "Set up your drinks & autofill presets", href: "/drinks" },
  { label: "Make sure your exec board has the passcode", href: "/settings#passcode" },
];

export function OnboardingChecklist() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-ink">Get the most out of your calendar</h2>
          <p className="mt-0.5 text-xs text-brand-ink/75">A few things worth doing once, whenever you get a minute:</p>
        </div>
        <form action={dismissOnboardingChecklistAction}>
          <button
            type="submit"
            className="shrink-0 rounded-md px-2 py-1 text-xs text-brand-ink/50 hover:bg-brand-ink/5 hover:text-brand-ink"
          >
            Dismiss
          </button>
        </form>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-brand-primary hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
