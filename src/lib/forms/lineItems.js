import { dollars, fail, fields, LIMITS, ok } from "@/lib/validation";

const amount = dollars("each amount", { required: true });

/**
 * The actual-spend rows shared by the event and equipment editors. A row with
 * both boxes empty is an unused "add" row and is skipped; a row with only one
 * filled in is an error, since saving it would silently drop what was typed.
 */
export function parseLineItems(formData, newId = () => crypto.randomUUID()) {
  const names = fields(formData, "actualSpendName");
  const amounts = fields(formData, "actualSpendAmount");
  const items = [];

  for (let i = 0; i < Math.max(names.length, amounts.length); i++) {
    const name = names[i] ?? "";
    const raw = amounts[i] ?? "";
    if (!name && !raw) continue;
    if (!name) return fail("Every actual-spend line needs a name.", { actualSpend: "missing name" });
    if (!raw) return fail(`Add an amount for "${name}", or remove that line.`, { actualSpend: "missing amount" });
    if (name.length > LIMITS.name) {
      return fail(`Line item names can be at most ${LIMITS.name} characters.`, { actualSpend: "too long" });
    }
    const parsed = amount.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0].message, { actualSpend: "bad amount" });
    items.push({ id: newId(), name, amountCents: parsed.data });
  }

  if (items.length > LIMITS.lineItems) {
    return fail(`Keep it to ${LIMITS.lineItems} actual-spend lines or fewer.`, { actualSpend: "too many" });
  }
  return ok(items);
}
