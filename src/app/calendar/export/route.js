import { getEvents, getCategories, getBrandingSettings } from "@/lib/data";
import { requireSemesters } from "@/lib/setup";
import { buildICS } from "@/lib/ics";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const semesters = await requireSemesters();
  const semester =
    semesters.find((s) => s.id === searchParams.get("semester")) ?? semesters[0];

  if (!semester) {
    return new Response("No semester found", { status: 404 });
  }

  const [events, categories, { chapterName }] = await Promise.all([
    getEvents(semester.id),
    getCategories(),
    getBrandingSettings(),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const ics = buildICS(events, semester.label, categoriesById, chapterName);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendar-${semester.id}.ics"`,
    },
  });
}
