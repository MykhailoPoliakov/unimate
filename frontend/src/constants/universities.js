export const UNIVERSITIES = [
  {
    id: 'kdg',
    name: 'Karel de Grote Hogeschool',
    shortName: 'KdG',
  },
];

export function getUniversity(id) {
  return UNIVERSITIES.find((university) => university.id === id) ?? UNIVERSITIES[0];
}
