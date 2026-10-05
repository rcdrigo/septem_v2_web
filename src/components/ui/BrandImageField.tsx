import { useId } from 'react';
import { Image, Loader2, Trash2 } from 'lucide-react';
import { useBrandImage } from '@/lib/use-brand-image';

export function BrandImageField({ kind, value, preview, fileName, tenantId, disabled, uploading, error, onSelect, onRemove }: {
  kind: 'logo' | 'hero';
  value: string | null;
  preview?: string;
  fileName?: string;
  tenantId: string;
  disabled: boolean;
  uploading: boolean;
  error?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const image = useBrandImage(preview || value, tenantId);
  const label = kind === 'logo' ? 'Logo do sistema' : 'Imagem de destaque';

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3" aria-busy={uploading}>
      <legend className="mb-2 text-sm font-medium text-slate-700">{label}</legend>
      <div className={`flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 ${kind === 'logo' ? 'h-24' : 'aspect-video'}`}>
        {image ? <img src={image} alt={`Prévia: ${label.toLowerCase()}`} className={kind === 'logo' ? 'h-full max-w-full object-contain p-3' : 'h-full w-full object-cover'} /> : (
          <div className="flex items-center gap-2 px-3 text-sm text-slate-500">
            <Image size={18} aria-hidden="true" /> {value ? 'Imagem configurada' : 'Nenhuma imagem anexada'}
          </div>
        )}
      </div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="file" name={kind === 'logo' ? 'logoUrl' : 'heroImageUrl'}
        accept="image/png,image/jpeg,image/gif,image/webp" aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onSelect(file);
        }}
        className="block w-full min-w-0 rounded-md text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-60" />
      <p id={`${id}-help`} className="text-xs text-slate-600">PNG, JPEG, GIF ou WebP. {kind === 'logo' ? 'Aparece no cabeçalho e na tela de login.' : 'Usada como fundo do painel de apresentação no login.'}</p>
      <div aria-live="polite" className="text-sm text-slate-600">
        {uploading ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Enviando imagem…</span> : fileName && <p className="break-all">{fileName} · Anexada</p>}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-rose-700">{error}</p>}
      {value && <button type="button" onClick={onRemove} className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-red-700 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60">
        <Trash2 size={16} aria-hidden="true" /> Remover imagem
      </button>}
    </fieldset>
  );
}
