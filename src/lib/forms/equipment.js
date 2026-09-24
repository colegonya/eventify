import { z } from "zod";
import { check, dollars, field, LIMITS, ok, optionalText, requiredText } from "@/lib/validation";
import { parseLineItems } from "@/lib/forms/lineItems";

const schema = z.object({
  name: requiredText("The item name"),
  priority: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 999), "Priority must be a whole number from 0 to 999."),
  expectedCost: dollars("expected cost"),
  // Rendered as a link on the Budget page, so only web addresses: never
  // javascript: or data: URLs.
  link: z
    .string()
    .trim()
    .max(LIMITS.url, `The link can be at most ${LIMITS.url} characters.`)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "The link must start with http:// or https://."),
  notes: optionalText("Notes", LIMITS.notes),
});

export function parseEquipmentForm(formData) {
  const base = check(schema, {
    name: field(formData, "name"),
    priority: field(formData, "priority"),
    expectedCost: field(formData, "expectedCost"),
    link: field(formData, "link"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!base.ok) return base;

  const lineItems = parseLineItems(formData);
  if (!lineItems.ok) return lineItems;

  const e = base.data;
  return ok({
    name: e.name,
    priority: e.priority === "" ? 0 : Number(e.priority),
    expectedCostCents: e.expectedCost,
    expectedCostApproval: formData.get("expectedCostApproved") ? "approved" : "pending",
    actualSpend: lineItems.data,
    link: e.link,
    notes: e.notes,
  });
}
