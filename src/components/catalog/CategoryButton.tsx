import { Tags } from 'lucide-react';
import { FALLBACK_COLOR, NamedIcon, tintOf } from './category-catalog';

export function CategoryButton({ active, label, count, color, icon, onClick }: { active: boolean; label: string; count: number; color?: string | null; icon?: string | null; onClick: () => void }) {
  const tone = color ?? FALLBACK_COLOR;
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700 active:bg-slate-100 ${active ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: tintOf(tone), color: tone }}><NamedIcon name={icon} fallback={<Tags size={14} />} /></span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-slate-400">{count}</span>
    </button>
  );
}
