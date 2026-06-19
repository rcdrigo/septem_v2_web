/**
 * Catálogo curado de ícones FontAwesome (free) para identificar grupos do
 * formulário. Guardamos a classe completa (ex.: `fa-solid fa-building`); o
 * picker permite alternar entre estilo sólido/regular e filtrar por termo.
 */
export const FA_STYLES = [
  { prefix: 'fa-solid', label: 'Sólido', short: 'fas' },
  { prefix: 'fa-regular', label: 'Regular', short: 'far' },
] as const;

/** Nomes de ícones comuns (sem o prefixo de estilo). */
export const FA_ICON_NAMES: string[] = [
  'user', 'users', 'user-tie', 'user-shield', 'people-group', 'address-book', 'id-card',
  'building', 'city', 'industry', 'store', 'warehouse', 'house', 'landmark', 'hospital',
  'file', 'file-lines', 'file-signature', 'file-invoice', 'file-invoice-dollar', 'folder', 'folder-open',
  'clipboard', 'clipboard-list', 'clipboard-check', 'list', 'list-check', 'table', 'newspaper', 'book', 'book-open',
  'envelope', 'paper-plane', 'comment', 'comments', 'bell', 'phone', 'mobile', 'fax',
  'calendar', 'calendar-check', 'calendar-day', 'clock', 'hourglass',
  'check', 'xmark', 'circle-check', 'circle-xmark', 'circle-info', 'circle-question', 'circle-exclamation', 'triangle-exclamation',
  'magnifying-glass', 'filter', 'tag', 'tags', 'star', 'heart', 'bookmark', 'flag', 'thumbs-up', 'thumbs-down',
  'pen', 'pencil', 'trash', 'plus', 'minus', 'gear', 'gears', 'wrench', 'screwdriver-wrench', 'hammer',
  'lock', 'unlock', 'key', 'shield', 'shield-halved',
  'money-bill', 'credit-card', 'cart-shopping', 'receipt', 'calculator', 'percent', 'scale-balanced', 'gavel',
  'box', 'boxes-stacked', 'truck', 'car', 'plane', 'ship', 'gas-pump',
  'database', 'server', 'cloud', 'wifi', 'desktop', 'print', 'link', 'paperclip', 'image', 'camera',
  'location-dot', 'map', 'globe', 'briefcase', 'graduation-cap',
  'heart-pulse', 'notes-medical', 'syringe', 'pills', 'stethoscope', 'tooth', 'eye',
  'chart-bar', 'chart-line', 'chart-pie', 'handshake', 'signature',
];

/** Classe completa a partir de um prefixo de estilo e nome. */
export function faClass(prefix: string, name: string): string {
  return `${prefix} fa-${name}`;
}
