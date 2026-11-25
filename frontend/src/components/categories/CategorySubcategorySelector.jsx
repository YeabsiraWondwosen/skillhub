import Select from '@/components/ui/Select';
import { useCategoryTree } from '@/hooks/useCategories';

/**
 * Form-mode dependent Category → Subcategory selector.
 * Sources both levels from the single canonical category tree API.
 *
 * Props:
 *   categoryId     {string} – controlled selected main-category _id
 *   subcategoryId  {string} – controlled selected subcategory _id
 *   onChange       {function} – ({ categoryId, subcategoryId }) => void
 */
export default function CategorySubcategorySelector({
  categoryId = '',
  subcategoryId = '',
  onChange,
}) {
  const { data: treeData, isLoading } = useCategoryTree();
  const parents = treeData?.data ?? [];

  const selectedMain = parents.find((c) => c._id === categoryId) ?? null;
  const subs = selectedMain?.subcategories ?? [];

  const handleCategory = (id) => {
    onChange({ categoryId: id, subcategoryId: '' });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select
        label="Category"
        value={categoryId}
        onChange={(e) => handleCategory(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Loading categories…' : 'Select a category'}</option>
        {parents.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select
        label="Subcategory"
        value={subcategoryId}
        onChange={(e) => onChange({ categoryId, subcategoryId: e.target.value })}
        disabled={!categoryId || subs.length === 0}
      >
        <option value="">
          {!categoryId ? 'Select a category first' : 'Select a subcategory'}
        </option>
        {subs.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
