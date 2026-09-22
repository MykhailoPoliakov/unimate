const MARKER_START = '\n\n<!--unimate-poll\n';
const MARKER_END = '\n-->';

export function parseNewsBody(raw) {
  const text = raw ?? '';
  const start = text.lastIndexOf(MARKER_START);
  if (start < 0 || !text.endsWith(MARKER_END)) {
    return { body: text, options: [] };
  }
  const inner = text.slice(start + MARKER_START.length, -MARKER_END.length);
  const options = inner
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return { body: text.slice(0, start).trimEnd(), options };
}

export function joinNewsBody(body, options) {
  const labels = (options ?? []).map((item) => item.trim()).filter(Boolean);
  const text = (body ?? '').trim();
  if (labels.length < 2) return text;
  return `${text}${MARKER_START}${labels.join('\n')}${MARKER_END}`;
}
