import { requireSemesters } from "@/lib/setup";
import { getBrandingSettings } from "@/lib/data";
import { BRAND_COLOR_VARS } from "@/lib/config";
import {
  createSemesterAction,
  updateSemesterAction,
  deleteSemesterAction,
  saveBrandingAction,
  updatePasscodeAction,
} from "@/lib/actions";
import { MIN_PASSCODE_LENGTH } from "@/lib/auth";
import { DeleteSemesterButton } from "@/components/DeleteSemesterButton";
import { ColorField } from "@/components/ColorField";

const fieldClass =
  "rounded-md border border-brand-ink/20 px-2 py-1.5 text-sm outline-none focus:border-brand-primary";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-brand-ink/75";

// Mirrors the default palette in globals.css, so a blank field still opens the
// swatch picker on the color the app is actually using.
const FALLBACK_SWATCHES = {
  primary: "#2563eb",
  accent: "#d97706",
  accentDeep: "#92400e",
  ink: "#1e293b",
};

const ERROR_MESSAGES = {
  name: "Give the semester a name.",
  dates: "A semester needs both a start and an end date.",
  order: "The end date can't be before the start date.",
  last: "You can't delete your only semester. Create another one first.",
  chapterName: "Give your chapter a name.",
  color: "Colors need to be six-digit hex codes, like #7b2132.",
  passcodeShort: `Use at least ${MIN_PASSCODE_LENGTH} characters.`,
  passcodeMismatch: "Those two passcodes don't match.",
};

export default async function SettingsPage({ searchParams }) {
  const params = await searchParams;
  const errorMessage = ERROR_MESSAGES[params?.error];
  const savedPasscode = params?.saved === "passcode";
  const semesters = await requireSemesters();
  const { chapterName, colors } = await getBrandingSettings();
  const sorted = [...semesters].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-lg font-semibold text-brand-ink">Settings</h1>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      )}

      <section id="chapter" className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-ink">Chapter</h2>
          <p className="mt-0.5 text-xs text-brand-ink/75">
            Your name and colors, used across the app and on your calendar export.
            Saved here, so you never have to touch your hosting settings to change them.
          </p>
        </div>

        <form
          action={saveBrandingAction}
          className="flex flex-col gap-4 rounded-xl border border-brand-ink/10 bg-white p-4 shadow-sm"
        >
          <label className={`${labelClass} max-w-sm`}>
            Chapter name
            <input
              name="chapterName"
              defaultValue={chapterName}
              required
              className={fieldClass}
            />
            <span className="font-normal text-brand-ink/60">
              Shows up as &ldquo;{chapterName} Social Calendar&rdquo;.
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-brand-ink/75">Colors</span>
            <div className="flex flex-wrap gap-4">
              {BRAND_COLOR_VARS.map(([, key, label]) => (
                <ColorField
                  key={key}
                  name={`color-${key}`}
                  label={label}
                  defaultValue={colors[key]}
                  fallback={FALLBACK_SWATCHES[key]}
                />
              ))}
            </div>
            <span className="text-xs text-brand-ink/60">
              Leave a field blank to use the default. Hex codes, like #7b2132.
            </span>
          </div>

          <button
            type="submit"
            className="self-start rounded-md border border-brand-ink/20 px-3 py-1.5 text-sm text-brand-ink hover:bg-brand-ink/5"
          >
            Save chapter details
          </button>
        </form>
      </section>

      <section id="semesters" className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-ink">Semesters</h2>
          <p className="mt-0.5 text-xs text-brand-ink/75">
            Each semester has its own events, contacts, and budget cap. Add one every
            term and switch between them from the Calendar and Budget tabs.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {sorted.map((semester) => (
            <form
              key={semester.id}
              action={updateSemesterAction}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-ink/10 bg-white p-3 shadow-sm"
            >
              <input type="hidden" name="semesterId" value={semester.id} />
              <label className={`${labelClass} min-w-40 flex-1`}>
                Name
                <input
                  name="label"
                  defaultValue={semester.label}
                  required
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Starts
                <input
                  type="date"
                  name="startDate"
                  defaultValue={semester.startDate}
                  required
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Ends
                <input
                  type="date"
                  name="endDate"
                  defaultValue={semester.endDate}
                  required
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Max budget ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="maxBudget"
                  defaultValue={(semester.maxBudgetCents / 100).toFixed(2)}
                  className={`${fieldClass} w-28`}
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-md border border-brand-ink/20 px-3 py-1.5 text-sm text-brand-ink hover:bg-brand-ink/5"
                >
                  Save
                </button>
                <DeleteSemesterButton
                  label={semester.label}
                  action={deleteSemesterAction}
                  disabled={semesters.length <= 1}
                />
              </div>
            </form>
          ))}
        </div>

        <form
          action={createSemesterAction}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-brand-ink/20 bg-brand-ink/[0.015] p-3"
        >
          <label className={`${labelClass} min-w-40 flex-1`}>
            New semester name
            <input
              name="label"
              placeholder="Spring 2027"
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Starts
            <input type="date" name="startDate" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Ends
            <input type="date" name="endDate" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Max budget ($)
            <input
              type="number"
              step="0.01"
              min="0"
              name="maxBudget"
              defaultValue="10000.00"
              className={`${fieldClass} w-28`}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Add semester
          </button>
        </form>
      </section>

      <section id="passcode" className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-ink">Shared passcode</h2>
          <p className="mt-0.5 text-xs text-brand-ink/75">
            The one passcode your whole exec board logs in with. Change it when
            officers turn over, or if it ends up somewhere it shouldn&apos;t.
            Everyone else gets signed out and will need the new one; you stay
            signed in here.
          </p>
        </div>

        {savedPasscode && (
          <p
            role="status"
            className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            Passcode updated. Everyone else has been signed out.
          </p>
        )}

        <form
          action={updatePasscodeAction}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-ink/10 bg-white p-3 shadow-sm"
        >
          <label className={`${labelClass} min-w-44 flex-1`}>
            New passcode
            <input
              type="password"
              name="passcode"
              autoComplete="new-password"
              required
              minLength={MIN_PASSCODE_LENGTH}
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} min-w-44 flex-1`}>
            Type it again
            <input
              type="password"
              name="passcodeConfirm"
              autoComplete="new-password"
              required
              minLength={MIN_PASSCODE_LENGTH}
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-brand-ink/20 px-3 py-1.5 text-sm text-brand-ink hover:bg-brand-ink/5"
          >
            Change passcode
          </button>
        </form>
      </section>
    </div>
  );
}
