import "server-only";
import { redirect } from "next/navigation";
import { ensureDefaults } from "@/lib/data";

/**
 * The gate every app page goes through. A deployment with no semesters has
 * never been set up, so there's nothing meaningful to render — send it to
 * /setup instead of an empty calendar. Returns the semester list otherwise,
 * since callers need it immediately.
 */
export async function requireSemesters() {
  const semesters = await ensureDefaults();
  if (semesters.length === 0) redirect("/setup");
  return semesters;
}
