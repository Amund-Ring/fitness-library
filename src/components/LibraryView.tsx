import { useState } from 'react';
import { ArrowUpRight, CircleCheck, Plus, Search } from 'lucide-react';
import { exerciseCategories, placementOf, type Exercise, type Workspace } from '../domain/model';
import { categoryOf, equipmentKind } from '../domain/categories';
import { CategoryBadge } from './CategoryBadge';

export function LibraryView({
  state,
  editable,
  onDetail,
  onNew,
}: {
  state: Workspace;
  editable: boolean;
  onDetail: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [grouping, setGrouping] = useState('category');
  const [sort, setSort] = useState('name');
  const [usage, setUsage] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [archived, setArchived] = useState(false);
  const rows = state.exercises
    .filter((e) => {
      const place = placementOf(state, e.id);
      return (
        (archived ? e.availability === 'archived' : e.availability === 'available') &&
        (category === 'all' || categoryOf(e) === category) &&
        (usage === 'all' || (usage === 'active' ? !!place : !place)) &&
        (equipment === 'all' || equipmentKind(e.equipmentType) === equipment) &&
        [
          e.name,
          ...e.legacyNames,
          ...e.primaryMuscles,
          ...e.secondaryMuscles,
          categoryOf(e),
          e.equipmentType,
          e.notes,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name),
    );
  const groups: { label: string; exercises: Exercise[] }[] =
    grouping === 'category'
      ? exerciseCategories
          .map((label) => ({ label, exercises: rows.filter((e) => categoryOf(e) === label) }))
          .filter((g) => g.exercises.length)
      : grouping === 'usage'
        ? [
            {
              label: 'In workout program',
              exercises: rows.filter((e) => !!placementOf(state, e.id)),
            },
            {
              label: 'Not in workout program',
              exercises: rows.filter((e) => !placementOf(state, e.id)),
            },
          ].filter((group) => group.exercises.length)
        : [{ label: 'All exercises', exercises: rows }];
  return (
    <>
      <div className="section-heading">
        <h1>
          Exercise library <span className="heading-count">{rows.length}</span>
        </h1>
        <button className="button primary" disabled={!editable} onClick={onNew}>
          <Plus size={17} /> Add exercise
        </button>
      </div>
      <section className="library-panel">
        <div className="library-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search exercises"
              placeholder="Search exercises…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {exerciseCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Group exercises"
            value={grouping}
            onChange={(e) => setGrouping(e.target.value)}
          >
            <option value="category">Group by category</option>
            <option value="usage">Group by workout inclusion</option>
            <option value="none">Ungrouped list</option>
          </select>
          <select
            aria-label="Sort exercises"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Name A–Z</option>
            <option value="added">Date added</option>
          </select>
        </div>
        <div className="library-options">
          <div className="filter-toggle" role="group" aria-label="Workout inclusion">
            {(
              [
                ['all', 'All exercises'],
                ['active', 'In workouts'],
                ['inactive', 'Not in workouts'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={usage === value}
                onClick={() => setUsage(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="filter-toggle" role="group" aria-label="Equipment filter">
            {(
              [
                ['all', 'All equipment'],
                ['Machine', 'Machine'],
                ['Free weights', 'Free weights'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={equipment === value}
                onClick={() => setEquipment(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />{' '}
            Show archived
          </label>
        </div>
        {groups.map((group) => (
          <section className="library-group" key={group.label} aria-label={group.label}>
            {grouping !== 'none' && (
              <h2 className="group-heading">
                {grouping === 'category' ? (
                  <CategoryBadge category={group.label as ReturnType<typeof categoryOf>} />
                ) : (
                  <span className="usage-group-label">
                    {group.label === 'In workout program' && (
                      <CircleCheck size={17} className="in-program-icon" />
                    )}
                    {group.label}
                  </span>
                )}
                <span>{group.exercises.length}</span>
              </h2>
            )}
            <div className="library-table">
              <div className="library-table-head">
                <span>Exercise</span>
                <span>Muscle detail</span>
                <span>Equipment</span>
                <span>Workout</span>
                <span />
              </div>
              {group.exercises.map((e) => (
                <button key={e.id} className="library-row" onClick={() => onDetail(e.id)}>
                  <span className="library-name">
                    {placementOf(state, e.id) && (
                      <span
                        className="membership-check"
                        role="img"
                        aria-label={`In workout program: Workout ${placementOf(state, e.id)!.workoutId}`}
                        title={`In Workout ${placementOf(state, e.id)!.workoutId}`}
                      >
                        <CircleCheck size={19} aria-hidden="true" />
                      </span>
                    )}
                    <span>
                      <strong>{e.name}</strong>
                      {grouping !== 'category' && <CategoryBadge category={categoryOf(e)} />}
                    </span>
                  </span>
                  <span className="library-muscle">{e.primaryMuscles.join(' · ')}</span>
                  <span className="library-equipment">{equipmentKind(e.equipmentType) || '—'}</span>
                  <span className="placement-cell">
                    {placementOf(state, e.id) ? (
                      <span
                        className={`pill workout-badge workout-${placementOf(state, e.id)!.workoutId}`}
                      >
                        Workout {placementOf(state, e.id)!.workoutId}
                      </span>
                    ) : (
                      <span className="quiet">{e.type === 'cardio' ? 'Finisher' : '—'}</span>
                    )}
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          </section>
        ))}
        {rows.length === 0 && (
          <div className="empty-state">
            <h2>No exercises found</h2>
            <p>Try another search or category.</p>
          </div>
        )}
      </section>
    </>
  );
}
