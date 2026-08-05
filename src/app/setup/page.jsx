import { redirect } from "next/navigation";
import { ensureDefaults, getBrandingSettings } from "@/lib/data";
import { completeSetupAction } from "@/lib/actions";
import { Masthead } from "@/components/Masthead";

const fieldClass =
  "rounded-sm border border-brand-ink/20 bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";
const labelClass = "flex flex-col gap-1.5 text-xs font-medium text-brand-ink/75";

const ERROR_MESSAGES = {
  chapterName: "Give your chapter a name.",
  name: "Give the semester a name.",
  dates: "A semester needs both a start and an end date.",
  order: "The end date can't be before the start date.",
};

export default async function SetupPage({ searchParams }) {
  const params = await searchParams;
  const semesters = await ensureDefaults();
  const { chapterName } = await getBrandingSettings();

  // Already set up — nothing here should be reachable, and re-running it would
  // only invite confusion about which semester is the real one.
  if (semesters.length > 0) redirect("/calendar");

  const errorMessage = ERROR_MESSAGES[params?.error];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 p-6">
      <div>
        <Masthead>Set up your calendar</Masthead>
        <p className="mt-2 text-sm text-brand-ink/75">
          Two things to fill in and you&apos;re done. You can change all of it later
          from the Settings tab, and add more semesters as terms go by.
        </p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      )}

      <form action={completeSetupAction} className="flex flex-col gap-4">
        <label className={labelClass}>
          Chapter name
          <input
            name="chapterName"
            defaultValue={chapterName === "Blank" ? "" : chapterName}
            placeholder="Alpha Beta"
            required
            autoFocus
            className={fieldClass}
          />
          <span className="font-normal text-brand-ink/60">
            Used throughout the app and on your calendar export.
          </span>
        </label>

        <label className={labelClass}>
          Semester name
          <input
            name="label"
            placeholder="Fall 2026"
            required
            className={fieldClass}
          />
        </label>

        <div className="flex gap-3">
          <label className={`${labelClass} flex-1`}>
            First day
            <input type="date" name="startDate" required className={fieldClass} />
          </label>
          <label className={`${labelClass} flex-1`}>
            Last day
            <input type="date" name="endDate" required className={fieldClass} />
          </label>
        </div>

        <label className={labelClass}>
          Social budget for the semester ($)
          <input
            type="number"
            step="0.01"
            min="0"
            name="maxBudget"
            defaultValue="10000.00"
            className={fieldClass}
          />
          <span className="font-normal text-brand-ink/60">
            A rough number is fine. Everything you spend gets measured against it.
          </span>
        </label>

        <label className="flex items-start gap-2.5 rounded-md border border-paper-line bg-brand-ink/[0.015] p-3 text-sm shadow-[var(--shadow-resting)]">
          <input
            type="checkbox"
            name="exampleData"
            value="1"
            className="mt-0.5 size-4 shrink-0 accent-brand-primary"
          />
          <span className="text-brand-ink/75">
            <span className="font-medium text-brand-ink">Fill it with example events first.</span>{" "}
            Made-up events, contacts, and game days spread across the dates above, so
            you can see how the calendar and budget work. Delete them whenever. Leave
            this unchecked to start with an empty calendar.
          </span>
        </label>

        <button
          type="submit"
          className="rounded-sm bg-brand-primary px-4 py-2.5 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          Create semester
        </button>
      </form>
    </div>
  );
}
