import { Select } from '@/components/ui/Field';
import { useEmailTemplates } from '@/lib/api/catalog';

/** Select de modelo de e-mail (T2). Grava o id (publicId) do modelo. */
export function EmailTemplateSelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const tpls = useEmailTemplates();
  const base = (tpls.data ?? []).map((t) => ({ value: t.id, label: t.name }));
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  return (
    <Select
      value={value}
      options={options}
      placeholder={tpls.isLoading ? 'Carregando…' : 'Selecione o modelo de e-mail'}
      disabled={tpls.isLoading}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
