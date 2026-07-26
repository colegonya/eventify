import { getCategories } from "@/lib/data";
import { requireSemesters } from "@/lib/setup";
import { CategoriesEditor } from "@/components/CategoriesEditor";

export default async function CategoriesPage() {
  await requireSemesters();
  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-lg font-semibold text-brand-ink">Categories</h1>
      <CategoriesEditor categories={categories} />
    </div>
  );
}
