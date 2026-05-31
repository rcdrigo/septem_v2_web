import { Select } from '@/components/ui/Field';
import { useDataSources } from '@/lib/api/catalog';

/**
 * Select de fonte de dados (T1). Grava o id (publicId) da fonte; mantém valores
 * legados (refs digitados antes do catálogo) selecionáveis.
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
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  return (
    <Select
      value={value}
      options={options}
      placeholder={ds.isLoading ? 'Carregando…' : (placeholder ?? 'Selecione a fonte de dados')}
      disabled={ds.isLoading}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
