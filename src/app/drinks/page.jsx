import { getDrinkPresets, getDrinkGroups, getCategories } from "@/lib/data";
import { requireSemesters } from "@/lib/setup";
import { Masthead } from "@/components/Masthead";
import { DrinkGroupsEditor } from "@/components/DrinkGroupsEditor";
import { DrinkPresetsEditor } from "@/components/DrinkPresetsEditor";

export default async function DrinksPage() {
  await requireSemesters();
  const [presets, groups, categories] = await Promise.all([
    getDrinkPresets(),
    getDrinkGroups(),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Masthead>Drinks</Masthead>
      <DrinkGroupsEditor groups={groups} />
      <DrinkPresetsEditor presets={presets} groups={groups} categories={categories} />
    </div>
  );
}
