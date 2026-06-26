import { useFormStore } from '@/stores/form';
import { Combobox } from '@/components/ui/Combobox';

/**
 * Seletor pesquisável de campo do formulário (grava a chave do campo). Lê os
 * campos do `formStore` (populado a partir do schema). Mantém valores legados.
 */
export function FormFieldSelect({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const fields = useFormStore((s) => s.fields);
  const base = fields.map((f) => ({ value: f.id, label: `${f.label || f.id} (${f.id})` }));
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;
  return (
    <Combobox
      value={value}
      options={options}
      onChange={onChange}
      clearLabel="— nenhum —"
      placeholder={placeholder ?? 'Selecione o campo do formulário'}
    />
  );
}
