import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PlaceholderBox, Section } from '@/components/ui/Field';
import { Dialog } from '@/components/ui/Dialog';
import { getIncomingConnections, getOutgoingConnections, type ConnectionRef } from '@/lib/bpmn-helpers';
import { GatewayConditionEditor } from '../editors/GatewayConditionEditor';

type Props = {
  modeler: any;
  element: any;
  /** Quais conexões listar — gateways de desvio mostram saídas; convergência mostra entradas. */
  direction: 'outgoing' | 'incoming';
  /** Se true, mostra o botão "Configurar condições" por conexão (gateways condicionais). */
  configurableConditions?: boolean;
};

/**
 * Seção "Vínculos" — lista as tarefas conectadas a este gateway. Para gateways
 * condicionais, cada conexão pode ser expandida revelando o `GatewayConditionEditor`.
 *
 * Espelha `ConfigGatewayFork.aspx` + `ConfigGatewayForkConditions.aspx` (split)
 * e `ConfigGatewayJoin.aspx` (join).
 */
export function GatewayLinksSection({ modeler, element, direction, configurableConditions }: Props) {
  const connections: ConnectionRef[] =
    direction === 'outgoing' ? getOutgoingConnections(element) : getIncomingConnections(element);

  const title = direction === 'outgoing' ? 'Tarefas de destino' : 'Tarefas de origem';
  const empty =
    direction === 'outgoing'
      ? 'Nenhuma conexão de saída ainda. Conecte este gateway a outros elementos.'
      : 'Nenhuma conexão de entrada ainda. Conecte outros elementos a este gateway.';

  return (
    <Section title={title}>
      {connections.length === 0 && <PlaceholderBox>{empty}</PlaceholderBox>}

      {connections.length > 0 && (
        <ul className="flex flex-col gap-2">
          {connections.map((c) => (
            <ConnectionItem
              key={c.id}
              modeler={modeler}
              connection={c}
              configurable={!!configurableConditions}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ConnectionItem({
  modeler,
  connection,
  configurable,
}: {
  modeler: any;
  connection: ConnectionRef;
  configurable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const flowBO = modeler?.get?.('elementRegistry').get(connection.id);

  return (
    <li className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-slate-900">{connection.otherLabel}</span>
          <span className="truncate text-xs text-slate-400">{connection.otherId}</span>
        </div>
        {configurable && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal size={12} />
            Configurar condições
          </button>
        )}
      </div>

      {configurable && open && flowBO && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={`Condições — ${connection.otherLabel}`}
          width="lg"
          footer={<button type="button" onClick={() => setOpen(false)} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Concluído</button>}
        >
          <GatewayConditionEditor modeler={modeler} connection={flowBO} />
        </Dialog>
      )}
    </li>
  );
}
