import { z } from "zod";
import {
  check,
  dollars,
  fail,
  field,
  isoDate,
  isRealIsoDate,
  isTime,
  LIMITS,
  ok,
  optionalText,
  requiredText,
} from "@/lib/validation";
import { parseLineItems } from "@/lib/forms/lineItems";

const optionalTime = (label) =>
  z.string().trim().refine((v) => v === "" || isTime(v), `${label} must be a time like 19:30.`);

const schema = z
  .object({
    name: requiredText("The event name"),
    category: z.string(),
    host: optionalText("Host", LIMITS.name),
    startDate: isoDate("Pick a start date."),
    endDate: z.string().trim().refine((v) => v === "" || isRealIsoDate(v), "Pick a real end date."),
    startTime: optionalTime("Start time"),
    endTime: optionalTime("End time"),
    status: z.enum(["confirmed", "tentative"], "Status must be Confirmed or Tentative."),
    expectedSpend: dollars("expected spend"),
    hostShare: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) <= 100), "Host's share must be a percentage from 0 to 100."),
    revenue: dollars("revenue"),
    notes: optionalText("Notes", LIMITS.notes),
  })
  .refine((e) => !e.endDate || e.endDate >= e.startDate, {
    message: "The end date can't be before the start date.",
    path: ["endDate"],
  });

/**
 * Validates the event editor's submission. `categoryIds` is every category
 * that currently exists; an event can't be saved into one that doesn't.
 */
export function parseEventForm(formData, categoryIds) {
  const base = check(schema, {
    name: field(formData, "name"),
    category: field(formData, "category"),
    host: field(formData, "host"),
    startDate: field(formData, "startDate"),
    endDate: field(formData, "endDate"),
    startTime: field(formData, "startTime"),
    endTime: field(formData, "endTime"),
    status: field(formData, "status") || "confirmed",
    expectedSpend: field(formData, "expectedSpend"),
    hostShare: field(formData, "hostShareFraction"),
    revenue: field(formData, "revenue"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!base.ok) return base;

  const e = base.data;
  if (!categoryIds.has(e.category)) {
    return categoryIds.size === 0
      ? fail("Add a category on the Categories tab before creating events.", { category: "none" })
      : fail("Pick a category.", { category: "missing" });
  }

  const lineItems = parseLineItems(formData);
  if (!lineItems.ok) return lineItems;

  return ok({
    name: e.name,
    category: e.category,
    host: e.host,
    startDate: e.startDate,
    endDate: e.endDate || e.startDate,
    startTime: e.startTime || null,
    endTime: e.endTime || null,
    status: e.status,
    expectedSpendCents: e.expectedSpend,
    expectedSpendApproval: formData.get("expectedSpendApproved") ? "approved" : "pending",
    actualSpend: lineItems.data,
    hostShareFraction: e.hostShare === "" ? null : Number(e.hostShare) / 100,
    revenueCents: e.revenue,
    notes: e.notes,
  });
}
