export const DEFAULT_TAG_COLOR = '#0ea5e9';

export function normalizeTagColor(value: string): string | null {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) return '#' + [...color.slice(1)].map((digit) => digit + digit).join('');
  return null;
}

export function tagColorStyle(value?: string | null) {
  const backgroundColor = normalizeTagColor(value ?? '') ?? DEFAULT_TAG_COLOR;
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(backgroundColor.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return { backgroundColor, borderColor: backgroundColor, color: luminance > 0.179 ? '#000000' : '#ffffff' };
}
