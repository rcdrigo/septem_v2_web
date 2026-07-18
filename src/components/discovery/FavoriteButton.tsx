import { Star } from 'lucide-react';

export function FavoriteButton({ favorite, disabled, onToggle }: {
  favorite: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const label = favorite ? 'Remover dos favoritos' : 'Adicionar como favorito';
  return (
    <span className="group/favorite relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-pressed={favorite}
        disabled={disabled}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggle(); }}
        className={`relative z-20 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white shadow-sm before:absolute before:-inset-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 active:bg-slate-100 disabled:cursor-wait disabled:opacity-60 ${favorite ? 'border-amber-300 text-amber-500' : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-amber-500'}`}
      >
        <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
      </button>
      <span role="tooltip" className="pointer-events-none invisible absolute right-0 top-full z-40 mt-2 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity delay-[800ms] duration-150 group-hover/favorite:visible group-hover/favorite:opacity-100 group-focus-within/favorite:visible group-focus-within/favorite:opacity-100 group-focus-within/favorite:delay-0">
        {label}
      </span>
    </span>
  );
}
