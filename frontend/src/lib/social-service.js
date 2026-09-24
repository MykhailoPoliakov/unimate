export const SERVICES = [
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', hosts: ['instagram.com', 'instagr.am'] },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  { id: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', hosts: ['linkedin.com'] },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', hosts: ['tiktok.com'] },
  { id: 'x', label: 'X', icon: 'logo-twitter', hosts: ['twitter.com', 'x.com'] },
  { id: 'discord', label: 'Discord', icon: 'logo-discord', hosts: ['discord.com', 'discord.gg'] },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', hosts: ['whatsapp.com', 'wa.me'] },
  { id: 'telegram', label: 'Telegram', icon: 'paper-plane', hosts: ['t.me', 'telegram.me', 'telegram.org'] },
  { id: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat', hosts: ['snapchat.com'] },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit', hosts: ['reddit.com'] },
  { id: 'github', label: 'GitHub', icon: 'logo-github', hosts: ['github.com'] },
  { id: 'slack', label: 'Slack', icon: 'logo-slack', hosts: ['slack.com'] },
  { id: 'twitch', label: 'Twitch', icon: 'logo-twitch', hosts: ['twitch.tv'] },
  { id: 'spotify', label: 'Spotify', icon: 'musical-notes', hosts: ['spotify.com', 'open.spotify.com'] },
  { id: 'teams', label: 'Teams', icon: 'people', hosts: ['teams.microsoft.com', 'teams.live.com'] },
];

export const MANUAL_ICONS = [
  ...SERVICES.map((item) => ({ id: item.id, label: item.label, icon: item.icon })),
  { id: 'website', label: 'Website', icon: 'globe-outline' },
  { id: 'chat', label: 'Chat', icon: 'chatbubbles' },
  { id: 'mail', label: 'Mail', icon: 'mail' },
  { id: 'video', label: 'Video', icon: 'videocam' },
];

export function normalizeUrl(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function detectService(url) {
  try {
    const host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '').toLowerCase();
    return (
      SERVICES.find((item) => item.hosts.some((known) => host === known || host.endsWith(`.${known}`))) ??
      null
    );
  } catch {
    return null;
  }
}

const ICON_ALIASES = {
  'logo-spotify': 'musical-notes',
};

export function resolveIconName(name) {
  return ICON_ALIASES[name] ?? name ?? 'globe-outline';
}

export function socialIcon(item) {
  return resolveIconName(item?.icon || detectService(item?.url)?.icon || 'globe-outline');
}
