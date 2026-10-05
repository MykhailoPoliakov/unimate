export function moderatorScope(profile) {
  if (profile?.role !== 'moderator') return null;
  return {
    institutions: profile.moderatorInstitutions ?? [],
    programs: profile.moderatorPrograms ?? [],
    years: profile.moderatorYears ?? [],
  };
}

export function withinModeratorInstitutions(institutions, scope) {
  if (!scope?.institutions?.length) return institutions;
  return institutions.filter((item) => scope.institutions.includes(item.slug));
}

export function withinModeratorPrograms(programs, scope) {
  if (!scope?.programs?.length) return programs;
  return programs.filter((item) => scope.programs.includes(item.slug));
}

export function withinModeratorYears(years, scope) {
  if (!scope?.years?.length) return years;
  return years.filter((year) => scope.years.includes(year));
}
