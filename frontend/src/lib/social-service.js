export const SERVICES = [
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', hosts: ['instagram.com', 'instagr.am'], color: '#E1306C' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', hosts: ['linkedin.com'], color: '#0A66C2' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube', hosts: ['youtube.com', 'youtu.be'], color: '#FF0000' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', hosts: ['tiktok.com'], color: '#111111' },
  { id: 'x', label: 'X', icon: 'logo-twitter', hosts: ['twitter.com', 'x.com'], color: '#111111' },
  { id: 'discord', label: 'Discord', icon: 'logo-discord', hosts: ['discord.com', 'discord.gg'], color: '#5865F2' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', hosts: ['whatsapp.com', 'wa.me'], color: '#25D366' },
  { id: 'telegram', label: 'Telegram', icon: 'paper-plane', hosts: ['t.me', 'telegram.me', 'telegram.org'], color: '#229ED9' },
  { id: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat', hosts: ['snapchat.com'], color: '#FFFC00' },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit', hosts: ['reddit.com'], color: '#FF4500' },
  { id: 'github', label: 'GitHub', icon: 'logo-github', hosts: ['github.com'], color: '#181717' },
  { id: 'slack', label: 'Slack', icon: 'logo-slack', hosts: ['slack.com'], color: '#4A154B' },
  { id: 'twitch', label: 'Twitch', icon: 'logo-twitch', hosts: ['twitch.tv'], color: '#9146FF' },
  { id: 'spotify', label: 'Spotify', icon: 'musical-notes', hosts: ['spotify.com', 'open.spotify.com'], color: '#1DB954' },
  { id: 'teams', label: 'Teams', icon: 'people', hosts: ['teams.microsoft.com', 'teams.live.com'], color: '#5059C9' },
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

export function brandForIcon(iconName) {
  const resolved = resolveIconName(iconName);
  return (
    SERVICES.find((item) => item.icon === resolved) ??
    MANUAL_ICONS.find((item) => item.icon === resolved) ??
    null
  );
}

export function brandColor(item) {
  const fromPlatform = SERVICES.find((row) => row.id === item?.platform)?.color;
  if (fromPlatform) return fromPlatform;
  return detectService(item?.url)?.color ?? brandForIcon(socialIcon(item))?.color ?? null;
}

export function iconOnBrand(color) {
  if (!color) return null;
  return color.toUpperCase() === '#FFFC00' ? '#111111' : '#F3F0E8';
}

export function nativeAppUrl(value) {
  try {
    const href = normalizeUrl(value);
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    const service = detectService(href);

    if (service?.id === 'instagram') {
      if (parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'tv') return href;
      if (parts[0] && !['explore', 'accounts'].includes(parts[0])) {
        return `instagram://user?username=${parts[0]}`;
      }
      return 'instagram://app';
    }
    if (service?.id === 'facebook') return `fb://facewebmodal/f?href=${encodeURIComponent(href)}`;
    if (service?.id === 'linkedin') return href.replace(/^https?:\/\//, 'linkedin://');
    if (service?.id === 'youtube') {
      const video = parsed.searchParams.get('v') || (host === 'youtu.be' ? parts[0] : null);
      return video ? `youtube://www.youtube.com/watch?v=${video}` : 'youtube://';
    }
    if (service?.id === 'tiktok') return href.replace(/^https?:\/\//, 'tiktok://');
    if (service?.id === 'x') {
      const name = parts[0] && !['i', 'search', 'home'].includes(parts[0]) ? parts[0] : null;
      return name ? `twitter://user?screen_name=${name}` : 'twitter://';
    }
    if (service?.id === 'discord') {
      if (host === 'discord.gg') return `discord://discord.gg/${parts[0] ?? ''}`;
      return href.replace(/^https?:\/\//, 'discord://');
    }
    if (service?.id === 'whatsapp') {
      const phone = host === 'wa.me' ? parts[0] : parsed.searchParams.get('phone');
      return phone ? `whatsapp://send?phone=${phone}` : 'whatsapp://send';
    }
    if (service?.id === 'telegram') {
      const domain = host === 't.me' || host === 'telegram.me' ? parts[0] : null;
      return domain ? `tg://resolve?domain=${domain}` : 'tg://';
    }
    if (service?.id === 'snapchat') {
      const user = parts[0] === 'add' ? parts[1] : parts[0];
      return user ? `snapchat://add/${user}` : 'snapchat://';
    }
    if (service?.id === 'reddit') return href.replace(/^https?:\/\//, 'reddit://');
    if (service?.id === 'slack') return 'slack://';
    if (service?.id === 'twitch') return parts[0] ? `twitch://stream/${parts[0]}` : 'twitch://';
    if (service?.id === 'spotify') {
      if (parts[0] && parts[1]) return `spotify:${parts[0]}:${parts[1]}`;
      return 'spotify://';
    }
    if (service?.id === 'teams') return href.replace(/^https?:\/\//, 'msteams://');
    return null;
  } catch {
    return null;
  }
}
