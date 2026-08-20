import { Pencil, Plus, RefreshCw } from 'lucide-react';
import { Combobox } from '@/components/ui/Combobox';
import { useDataSources } from '@/lib/api/catalog';
import { openTab } from '@/lib/nav';
import { routes } from '@/lib/routes';

/**
 * Seletor de fonte de dados (T1) — combobox pesquisável. Grava o id (publicId);
 * mantém valores legados (refs digitados antes do catálogo) selecionáveis.
 *
 * Ao lado do seletor: um ícone de **atualizar** a lista (refetch sem recarregar a
 * página — útil quando o usuário acabou de criar uma fonte em outra aba) e, quando
 * há uma fonte selecionada que está no catálogo, um link **editar** (abre o editor
 * em nova aba). O botão "Nova fonte de dados" pode ser suprimido (`showNew={false}`)
 * quando a página oferece um único botão acima de vários seletores (ex.: Rotinas).
 */
export function DataSourceSelect({
  value, onChange, placeholder, scope = 'form', showNew = true,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  scope?: 'form' | 'report';
  showNew?: boolean;
}) {
  const ds = useDataSources();
  const base = (ds.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  // Mantém o valor selecionado visível mesmo se não estiver na lista carregada.
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  // Só oferece "editar" quando a seleção é uma fonte do catálogo (id conhecido);
  // refs legados (texto livre) não têm editor.
  const canEdit = !!value && base.some((o) => o.value === value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <Combobox
            value={value}
            options={options}
            onChange={onChange}
            clearLabel="— nenhuma —"
            placeholder={ds.isLoading ? 'Carregando…' : (placeholder ?? 'Selecione a fonte de dados')}
            disabled={ds.isLoading}
          />
        </div>
        <button
          type="button"
          onClick={() => void ds.refetch()}
          disabled={ds.isFetching}
          title="Atualizar a lista de fontes de dados"
          aria-label="Atualizar fontes de dados"
          className="shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={ds.isFetching ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        {showNew && (
          <button
            type="button"
            onClick={() => openTab(`${routes.dataSource('nova')}?scope=${scope}`)}
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <Plus size={12} /> Nova fonte de dados
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => openTab(`${routes.dataSource(value)}?scope=${scope}`)}
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <Pencil size={12} /> Editar fonte selecionada
          </button>
        )}
      </div>
    </div>
  );
}
