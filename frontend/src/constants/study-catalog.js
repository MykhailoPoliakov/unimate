export const STUDY_CATALOG = [
  {
    slug: 'kdg',
    name: 'KdG University',
    programs: [
      { slug: 'acs', name: 'Applied Computer Science', duration_years: 3 },
      { slug: 'ibm', name: 'International Business Management', duration_years: 3 },
      { slug: 'mct', name: 'Multimedia & Creative Technologies', duration_years: 3 },
      { slug: 'nur', name: 'Nursing', duration_years: 3 },
    ],
  },
];

export function catalogInstitution(slug) {
  return STUDY_CATALOG.find((item) => item.slug === slug) ?? null;
}

function sortPrograms(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeInstitutions(items) {
  const bySlug = new Map(STUDY_CATALOG.map((item) => [item.slug, { ...item, programs: [...item.programs] }]));
  for (const item of items ?? []) {
    const current = bySlug.get(item.slug);
    if (!current) {
      bySlug.set(item.slug, { ...item, programs: item.programs ?? [] });
      continue;
    }
    const programs = new Map(current.programs.map((program) => [program.slug, program]));
    for (const program of item.programs ?? []) programs.set(program.slug, program);
    bySlug.set(item.slug, { ...current, ...item, programs: sortPrograms([...programs.values()]) });
  }
  return [...bySlug.values()];
}

export function mergePrograms(institutionSlug, items) {
  const catalog = catalogInstitution(institutionSlug)?.programs ?? [];
  const bySlug = new Map(catalog.map((program) => [program.slug, program]));
  for (const program of items ?? []) bySlug.set(program.slug, program);
  return sortPrograms([...bySlug.values()]);
}
