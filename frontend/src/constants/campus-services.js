export const CAMPUS_SERVICES = {
  kdg: [
    {
      id: 'canvas',
      url: 'https://canvas.kdg.be/',
      icon: 'canvas',
      color: '225, 63, 43',
      platform: 'canvas',
      translations: {
        nl: { title: 'Canvas', description: 'Cursussen, opdrachten en punten' },
        de: { title: 'Canvas', description: 'Kurse, Aufgaben und Noten' },
        fr: { title: 'Canvas', description: 'Cours, devoirs et notes' },
        en: { title: 'Canvas', description: 'Courses, assignments and grades' },
        uk: { title: 'Canvas', description: 'Курси, завдання та оцінки' },
        ru: { title: 'Canvas', description: 'Курсы, задания и оценки' },
      },
    },
    {
      id: 'student-service',
      url: 'https://E-studentservice.kdg.be/Main.aspx',
      icon: 'e-studentservice',
      color: '47, 95, 168',
      platform: 'student-service',
      translations: {
        nl: { title: 'E-studentservice', description: 'Studentenadministratie en aanvragen' },
        de: { title: 'E-studentservice', description: 'Studentenverwaltung und Anträge' },
        fr: { title: 'E-studentservice', description: 'Administration et demandes étudiantes' },
        en: { title: 'E-studentservice', description: 'Student administration and requests' },
        uk: { title: 'E-studentservice', description: 'Студентське адміністрування та запити' },
        ru: { title: 'E-studentservice', description: 'Студенческие услуги и запросы' },
      },
    },
    {
      id: 'website',
      url: 'https://www.kdg.be/en',
      icon: 'kdg-icon',
      color: '28, 28, 28',
      platform: 'website',
      translations: {
        nl: { title: 'KdG-website', description: 'Officieel nieuws, opleidingen en info van KdG' },
        de: { title: 'KdG-Website', description: 'Offizielle Website der KdG' },
        fr: { title: 'Site web de la KdG', description: 'Site web officiel de la KdG' },
        en: { title: 'KdG Website', description: 'Official KdG website' },
        uk: { title: 'Сайт KdG', description: 'Офіційний сайт KdG' },
        ru: { title: 'Сайт KdG', description: 'Официальный сайт KdG' },
      },
    },
    {
      id: 'schedule',
      url: 'https://cloud.timeedit.net/be_kdg/web/student/ri1Y315Q655Z54Q81.html',
      icon: 'timeedit',
      color: '140, 232, 196',
      platform: 'schedule',
      translations: {
        nl: { title: 'Rooster', description: 'Lesrooster' },
        de: { title: 'Stundenplan', description: 'Stundenplan' },
        fr: { title: 'Horaire', description: 'Emploi du temps' },
        en: { title: 'Schedule', description: 'Class timetable' },
        uk: { title: 'Розклад', description: 'Розклад' },
        ru: { title: 'Расписание', description: 'Расписание' },
      },
    },
  ],
};

export function campusServicesFor(institution, language = 'en') {
  const buttons = CAMPUS_SERVICES[institution];
  if (!buttons?.length) return [];
  return buttons.map((item) => {
    const translation = item.translations[language] ?? item.translations.en;
    return {
      id: `${institution}-${item.id}`,
      url: item.url,
      icon: item.icon,
      color: item.color,
      platform: item.platform,
      title: translation.title,
      description: translation.description,
    };
  });
}
