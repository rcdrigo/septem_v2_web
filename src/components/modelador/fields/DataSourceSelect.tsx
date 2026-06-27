import { Plus } from 'lucide-react';
import { Combobox } from '@/components/ui/Combobox';
import { useDataSources } from '@/lib/api/catalog';
import { openTab } from '@/lib/nav';

/**
 * Seletor de fonte de dados (T1) — combobox pesquisável. Grava o id (publicId);
 * mantém valores legados (refs digitados antes do catálogo) selecionáveis.
 * Inclui atalho para criar uma nova fonte (abre o editor em nova aba).
 */
export function DataSourceSelect({
  value, onChange, placeholder, scope = 'form',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  scope?: 'form' | 'report';
}) {
  const ds = useDataSources();
  const base = (ds.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  // Mantém o valor selecionado visível mesmo se não estiver na lista carregada.
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  return (
    <div className="flex flex-col gap-1.5">
      <Combobox
        value={value}
        options={options}
        onChange={onChange}
        clearLabel="— nenhuma —"
        placeholder={ds.isLoading ? 'Carregando…' : (placeholder ?? 'Selecione a fonte de dados')}
        disabled={ds.isLoading}
      />
      <button
        type="button"
        onClick={() => openTab(`/fonte-dados/nova?scope=${scope}`)}
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        <Plus size={12} /> Nova fonte de dados
      </button>
    </div>
  );
}
