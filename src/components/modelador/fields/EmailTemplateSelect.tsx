import { Combobox } from '@/components/ui/Combobox';
import { useEmailTemplates } from '@/lib/api/catalog';

/** Seletor de modelo de e-mail (T2) — combobox pesquisável. Grava o id (publicId). */
export function EmailTemplateSelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const tpls = useEmailTemplates();
  const base = (tpls.data ?? []).map((t) => ({ value: t.id, label: t.name }));
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  return (
    <Combobox
      value={value}
      options={options}
      onChange={onChange}
      clearLabel="— nenhum —"
      placeholder={tpls.isLoading ? 'Carregando…' : 'Selecione o modelo de e-mail'}
      disabled={tpls.isLoading}
    />
  );
}
