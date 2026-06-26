import { Combobox } from '@/components/ui/Combobox';
import { useDataSources } from '@/lib/api/catalog';

/**
 * Seletor de fonte de dados (T1) — combobox pesquisável. Grava o id (publicId);
 * mantém valores legados (refs digitados antes do catálogo) selecionáveis.
 */
export function DataSourceSelect({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const ds = useDataSources();
  const base = (ds.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  // Mantém o valor selecionado visível mesmo se não estiver na lista carregada.
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  return (
    <Combobox
      value={value}
      options={options}
      onChange={onChange}
      clearLabel="— nenhuma —"
      placeholder={ds.isLoading ? 'Carregando…' : (placeholder ?? 'Selecione a fonte de dados')}
      disabled={ds.isLoading}
    />
  );
}
