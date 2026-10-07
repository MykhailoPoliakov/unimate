export function moderatorScope(profile) {
  if (profile?.role !== 'moderator') return null;
  const institutions = profile.moderatorInstitutions?.length
    ? profile.moderatorInstitutions
    : profile.institution
      ? [profile.institution]
      : [];
  const programs = profile.moderatorPrograms?.length
    ? profile.moderatorPrograms
    : profile.program
      ? [profile.program]
      : [];
  return {
    institutions,
    programs,
    years: profile.moderatorYears ?? [],
  };
}

export function withinModeratorInstitutions(institutions, scope) {
  if (!scope) return institutions;
  if (!scope.institutions.length) return [];
  return institutions.filter((item) => scope.institutions.includes(item.slug));
}

export function withinModeratorPrograms(programs, scope) {
  if (!scope) return programs;
  if (!scope.programs.length) return [];
  return programs.filter((item) => scope.programs.includes(item.slug));
}

export function withinModeratorYears(years, scope) {
  if (!scope?.years?.length) return years;
  return years.filter((year) => scope.years.includes(year));
}
