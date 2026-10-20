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
  if (items == null) {
    return STUDY_CATALOG.map((item) => ({ ...item, programs: [...item.programs] }));
  }
  return [...items]
    .map((item) => ({ ...item, programs: [...(item.programs ?? [])] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mergePrograms(institutionSlug, items) {
  const programs = items ?? catalogInstitution(institutionSlug)?.programs ?? [];
  return sortPrograms(programs);
}
