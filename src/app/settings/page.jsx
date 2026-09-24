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
import { Masthead } from "@/components/Masthead";
import { DEFAULT_ORG_NOUN, DEFAULT_PERIOD_NOUN } from "@/lib/vocabulary";

const fieldClass =
  "rounded-sm border border-brand-ink/20 bg-background px-2 py-1.5 text-sm outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-brand-ink/75";

// Mirrors the default palette in globals.css, so a blank field still opens the
// swatch picker on the color the app is actually using.
const FALLBACK_SWATCHES = {
  primary: "#1e3a5f",
  accent: "#b8892b",
  accentDeep: "#7a5a17",
  ink: "#1c1c1a",
};

// Shown first in the picker. Everything else follows alphabetically.
const COMMON_TIME_ZONES = [
  ["America/Los_Angeles", "Pacific (Los Angeles)"],
  ["America/Denver", "Mountain (Denver)"],
  ["America/Phoenix", "Arizona (Phoenix)"],
  ["America/Chicago", "Central (Chicago)"],
  ["America/New_York", "Eastern (New York)"],
  ["America/Anchorage", "Alaska (Anchorage)"],
  ["Pacific/Honolulu", "Hawaii (Honolulu)"],
  ["UTC", "UTC"],
];

const errorMessages = (words) => ({
  name: `Give the ${words.periodLower} a name.`,
  dates: `A ${words.periodLower} needs both a start and an end date.`,
  order: "The end date can't be before the start date.",
  last: `You can't delete your only ${words.periodLower}. Create another one first.`,
  chapterName: `Give your ${words.orgLower} a name.`,
  color: "Colors need to be six-digit hex codes, like #7b2132.",
  passcodeShort: `Use at least ${MIN_PASSCODE_LENGTH} characters.`,
  passcodeMismatch: "Those two passcodes don't match.",
  budget: `Enter a budget for the ${words.periodLower}, even a rough one.`,
  nameLength: `Keep ${words.periodLower} names to 60 characters or fewer.`,
  length: "That name is too long. Keep names to 60 characters and words to 30.",
  timeZone: "Pick a time zone from the list.",
});

export default async function SettingsPage({ searchParams }) {
  const params = await searchParams;
  const savedPasscode = params?.saved === "passcode";
  const semesters = await requireSemesters();
  const { chapterName, colors, appTitle, appTitleOverride, words, timeZone } = await getBrandingSettings();
  // The saved zone always appears, even an alias the runtime doesn't list,
  // so saving the form never silently switches it to the first option.
  const otherTimeZones = [...new Set([timeZone, ...Intl.supportedValuesOf("timeZone")])]
    .filter((zone) => !COMMON_TIME_ZONES.some(([z]) => z === zone))
    .sort();
  const errorMessage = errorMessages(words)[params?.error];
  const sorted = [...semesters].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Masthead>Settings</Masthead>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      )}

      <section id="chapter" className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-brand-ink">{words.org}</h2>
          <p className="mt-0.5 text-xs text-brand-ink/75">
            Your name and colors, used across the app and on your calendar export.
            Saved here, so you never have to touch your hosting settings to change them.
          </p>
        </div>

        <form
          action={saveBrandingAction}
          className="flex flex-col gap-4 rounded-md border border-paper-line bg-background p-4 shadow-[var(--shadow-resting)]"
        >
          <label className={`${labelClass} max-w-sm`}>
            {words.org} name
            <input
              name="chapterName"
              defaultValue={chapterName}
              required
              className={fieldClass}
            />
            <span className="font-normal text-brand-ink/60">
              Shows up as &ldquo;{appTitle}&rdquo;.
            </span>
          </label>

          {/* The two words this app used to hardcode. "Chapter" and
              "Semester" are a fraternity's vocabulary, not everyone's: a
              non-profit board runs fiscal years and has no chapter at all. */}
          <div className="flex flex-wrap gap-4">
            <label className={`${labelClass} w-44`}>
              What you call yourselves
              <input
                name="orgNoun"
                defaultValue={words.org === DEFAULT_ORG_NOUN ? "" : words.org}
                placeholder={DEFAULT_ORG_NOUN}
                className={fieldClass}
              />
            </label>
            <label className={`${labelClass} w-44`}>
              What you call a term
              <input
                name="periodNoun"
                defaultValue={words.period === DEFAULT_PERIOD_NOUN ? "" : words.period}
                placeholder={DEFAULT_PERIOD_NOUN}
                className={fieldClass}
              />
            </label>
            <label className={`${labelClass} w-64`}>
              Title override
              <input
                name="appTitle"
                defaultValue={appTitleOverride}
                placeholder={appTitle}
                className={fieldClass}
              />
            </label>
          </div>
          <span className="-mt-2 text-xs text-brand-ink/60">
            Leave any of these blank to use the default. They change wording
            across the app, not your data.
          </span>

          <label className={`${labelClass} w-72`}>
            Time zone
            <select name="timeZone" defaultValue={timeZone} className={fieldClass}>
              <optgroup label="Common">
                {COMMON_TIME_ZONES.map(([zone, name]) => (
                  <option key={zone} value={zone}>
                    {name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All time zones">
                {otherTimeZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <span className="-mt-2 text-xs text-brand-ink/60">
            Decides when &ldquo;today&rdquo; starts on the calendar and contacts.
          </span>

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
            className="self-start rounded-sm border border-brand-ink/20 px-3 py-1.5 text-sm text-brand-ink transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
          >
            Save {words.orgLower} details
          </button>
        </form>
      </section>

      <section id="semesters" className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-brand-ink">{words.periodPlural}</h2>
          <p className="mt-0.5 text-xs text-brand-ink/75">
            Each {words.periodLower} has its own events, contacts, and budget cap. Add
            one every term and switch between them from the Calendar and Budget tabs.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-paper-line overflow-hidden rounded-md border border-paper-line bg-background shadow-[var(--shadow-resting)]">
          {sorted.map((semester) => (
            <form
              key={semester.id}
              action={updateSemesterAction}
              className="flex flex-wrap items-end gap-3 p-3"
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
                  className="rounded-sm border border-brand-ink/20 px-3 py-1.5 text-sm text-brand-ink transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
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
          className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-brand-ink/20 bg-brand-ink/[0.015] p-3"
        >
          <label className={`${labelClass} min-w-40 flex-1`}>
            New {words.periodLower} name
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
            className="rounded-sm bg-brand-primary px-3 py-1.5 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            Add {words.periodLower}
          </button>
        </form>
      </section>

      <section id="passcode" className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-brand-ink">Shared passcode</h2>
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
            className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            Passcode updated. Everyone else has been signed out.
          </p>
        )}

        <form
          action={updatePasscodeAction}
          className="flex flex-wrap items-end gap-3 rounded-md border border-paper-line bg-background p-3 shadow-[var(--shadow-resting)]"
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
            className="rounded-sm border border-brand-ink/20 px-3 py-1.5 text-sm text-brand-ink transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
          >
            Change passcode
          </button>
        </form>
      </section>
    </div>
  );
}
