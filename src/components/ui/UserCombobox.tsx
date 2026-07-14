import { useState } from 'react';
import { Combobox } from '@/components/ui/Combobox';
import { useUsersList, useUser } from '@/lib/api/users';

/**
 * Seleção de usuário com busca NO SERVIDOR. Uma prefeitura tem milhares de
 * servidores: carregar "os 200 primeiros" e filtrar no cliente esconde quem não
 * está na primeira página — o usuário digita o nome certo e não acha ninguém.
 *
 * O selecionado é carregado à parte (`useUser`) para o rótulo continuar aparecendo
 * mesmo quando ele não está no resultado da busca atual.
 */
export function UserCombobox({
  value,
  onChange,
  placeholder = 'Selecionar usuário…',
  clearLabel = 'Sem usuário',
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  clearLabel?: string;
}) {
  const [q, setQ] = useState('');
  const busca = useUsersList({ q: q || undefined, page: 1, pageSize: 20, status: 'active' });
  const selecionado = useUser(value || null);

  const options = (busca.data?.items ?? []).map((u) => ({ value: u.id, label: u.name }));
  if (selecionado.data && !options.some((o) => o.value === selecionado.data!.id)) {
    options.unshift({ value: selecionado.data.id, label: selecionado.data.name });
  }

  return (
    <Combobox
      value={value}
      options={options}
      onChange={onChange}
      onQueryChange={setQ}
      placeholder={placeholder}
      clearLabel={clearLabel}
    />
  );
}
