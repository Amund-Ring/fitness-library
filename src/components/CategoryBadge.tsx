import type { ExerciseCategory } from '../domain/model';

export function CategoryBadge({ category }: { category: ExerciseCategory }) {
  return <span className={`category-badge category-${category.toLowerCase()}`}>{category}</span>;
}
