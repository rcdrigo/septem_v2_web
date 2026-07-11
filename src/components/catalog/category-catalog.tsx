import type { ReactNode } from 'react';

/**
 * Visual compartilhado dos catálogos agrupados por categoria (Serviços e
 * Consultas): cores herdadas da categoria, pílula de filtro e agrupamento.
 */

export const FALLBACK_COLOR = '#0f172a'; // slate-900 — itens sem categoria/cor

/** Texto branco só quando a cor de fundo é escura o bastante (luminância). */
export function textColorFor(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 186 ? '#0f172a' : '#ffffff';
}

/** Fundo suave (~12% de alpha) para o chip do ícone do card. */
export function tintOf(hex: string): string {
  return /^#([0-9a-fA-F]{6})$/.test(hex) ? `${hex}1f` : '#f1f5f9';
}

export type CategorizedItem = {
  category: string | null;
  categoryId: number | null;
  categoryColor: string | null;
  categoryIcon: string | null;
};

export type CategoryGroup<T extends CategorizedItem> = {
  key: string; // categoryId ou 'none'
  name: string;
  color: string | null;
  icon: string | null;
  items: T[];
};

/** Agrupa por categoria, ordenando por nome com "Sem categoria" por último. */
export function groupByCategory<T extends CategorizedItem>(items: T[]): CategoryGroup<T>[] {
  const map = new Map<string, CategoryGroup<T>>();
  for (const it of items) {
    const key = it.categoryId != null ? String(it.categoryId) : 'none';
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: it.category ?? 'Sem categoria',
        color: it.categoryColor,
        icon: it.categoryIcon,
        items: [],
      });
    }
    map.get(key)!.items.push(it);
  }
  return [...map.values()].sort((a, b) =>
    a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name),
  );
}

export function FilterPill({ label, active, color, onClick }: { label: string; active: boolean; color: string | null; onClick: () => void }) {
  const base = color ?? FALLBACK_COLOR;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-transparent' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
      style={active ? { backgroundColor: base, color: textColorFor(base) } : undefined}
    >
      {color && !active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

/** Cabeçalho do agrupamento: chip colorido com o ícone + nome + contagem. */
export function GroupHeader({ name, color, icon, count, fallbackIcon }: { name: string; color: string; icon: string | null; count: number; fallbackIcon: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: tintOf(color), color }}>
        {icon?.includes('fa-') ? <i className={icon} /> : fallbackIcon}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{name}</h2>
      <span className="text-xs text-slate-400">{count}</span>
    </div>
  );
}
