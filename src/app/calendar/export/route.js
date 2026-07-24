import { ensureSeeded, getEvents, getCategories } from "@/lib/data";
import { buildICS } from "@/lib/ics";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const semesters = await ensureSeeded();
  const semester =
    semesters.find((s) => s.id === searchParams.get("semester")) ?? semesters[0];

  if (!semester) {
    return new Response("No semester found", { status: 404 });
  }

  const [events, categories] = await Promise.all([
    getEvents(semester.id),
    getCategories(),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const ics = buildICS(events, semester.label, categoriesById);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendar-${semester.id}.ics"`,
    },
  });
}
