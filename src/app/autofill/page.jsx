import { getDrinkPresets, getCustomDrinkItems, mergeDrinkItemGroups, getCategories } from "@/lib/data";
import { requireSemesters } from "@/lib/setup";
import { DrinkPresetsEditor } from "@/components/DrinkPresetsEditor";
import { CustomDrinkItemsEditor } from "@/components/CustomDrinkItemsEditor";

export default async function AutofillPage() {
  await requireSemesters();
  const [presets, customItems, categories] = await Promise.all([
    getDrinkPresets(),
    getCustomDrinkItems(),
    getCategories(),
  ]);
  const groups = mergeDrinkItemGroups(customItems);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-lg font-semibold text-brand-ink">Autofill</h1>
      <DrinkPresetsEditor presets={presets} groups={groups} categories={categories} />
      <CustomDrinkItemsEditor items={customItems} groups={groups} />
    </div>
  );
}
