import { ensureSeeded, getContacts } from "@/lib/data";
import { SemesterSwitcher } from "@/components/SemesterSwitcher";
import { ContactsTable } from "@/components/ContactsTable";

export default async function ContactsPage({
  searchParams,
}) {
  const params = await searchParams;
  const semesters = await ensureSeeded();

  if (semesters.length === 0) {
    return (
      <div className="p-6">
        <p className="text-brand-ink/75">No semesters yet.</p>
      </div>
    );
  }

  const semester =
    semesters.find((s) => s.id === params.semester) ?? semesters[0];
  const contacts = await getContacts(semester.id);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-brand-ink">Contacts</h1>
        <SemesterSwitcher
          semesters={semesters}
          selectedId={semester.id}
          basePath="/contacts"
        />
      </div>
      <ContactsTable key={semester.id} semesterId={semester.id} contacts={contacts} />
    </div>
  );
}
