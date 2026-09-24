import { getContacts, getBrandingSettings } from "@/lib/data";
import { todayInTimeZone } from "@/lib/dates";
import { requireSemesters } from "@/lib/setup";
import { SemesterSwitcher } from "@/components/SemesterSwitcher";
import { Masthead } from "@/components/Masthead";
import { ContactsTable } from "@/components/ContactsTable";

export default async function ContactsPage({
  searchParams,
}) {
  const params = await searchParams;
  const semesters = await requireSemesters();

  if (semesters.length === 0) {
    return (
      <div className="p-6">
        <p className="text-brand-ink/75">Nothing set up yet.</p>
      </div>
    );
  }

  const semester =
    semesters.find((s) => s.id === params.semester) ?? semesters[0];
  const [contacts, { words, timeZone }] = await Promise.all([
    getContacts(semester.id),
    getBrandingSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <Masthead>Contacts</Masthead>
        <SemesterSwitcher
          semesters={semesters}
          selectedId={semester.id}
          basePath="/contacts"
          periodLower={words.periodLower}
          periodPluralLower={words.periodPluralLower}
        />
      </div>
      <ContactsTable
        key={semester.id}
        semesterId={semester.id}
        contacts={contacts}
        todayISO={todayInTimeZone(timeZone)}
      />
    </div>
  );
}
