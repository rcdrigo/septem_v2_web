import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, TextInput } from '@/components/ui/Field';
import type { NativeFormDefinition } from '@/lib/native-form';
import { NATIVE_CATALOG, createNativeGroup, createNativeTable, convertNativeGroup, findNativeGroup, moveNativeElement, type NativeElementType } from '@/lib/native-form-editor';

export type StructureAction = { type: 'table'; tabId: string } | { type: 'convert'; groupId: string } | { type: 'transfer'; groupId: string; fieldId: string };
const button = 'min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50';
export function NativeStructureDialog({ action, definition, update, onClose, onSelect }: {
  action: StructureAction;
  definition: NativeFormDefinition;
  update: (change: (next: NativeFormDefinition) => void) => void;
  onClose: () => void;
  onSelect: (selection: { tabId: string; groupId: string; fieldId?: string }) => void;
}) {
  const [count, setCount] = useState('2');
  const [types, setTypes] = useState<NativeElementType[]>(['textfield', 'number']);
  const [destinationId, setDestinationId] = useState('');
  const [error, setError] = useState('');
  const source = action.type === 'table' ? undefined : findNativeGroup(definition, action.groupId).group;
  const field = action.type === 'transfer' ? source?.fields.find(f => f.id === action.fieldId) : undefined;
  const presentations = source?.fields.filter(f => f.kind === 'presentation') ?? [];
  const destinations = definition.tabs.flatMap(tab => tab.groups.filter(g => g.id !== source?.id &&
    (action.type === 'convert' || field?.kind === 'presentation' ? g.type === 'group' : true)).map(group => ({ tab, group })));
  const destination = destinations.find(d => d.group.id === destinationId);
  const columnCount = Number(count);
  const validCount = Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 100;
  const needsDestination = action.type === 'transfer' || (action.type === 'convert' && presentations.length > 0);
  const ready = action.type === 'table' ? validCount : !needsDestination || !!destination || (action.type === 'convert' && destinationId === 'new');
  function submit() {
    if (!ready) return;
    try {
      let selection: { tabId: string; groupId: string; fieldId?: string } | undefined;
      update(next => {
        if (action.type === 'table') {
          const tab = next.tabs.find(t => t.id === action.tabId)!;
          const table = createNativeTable(`Tabela ${tab.groups.length + 1}`, Array.from({ length: columnCount }, (_, i) => types[i] ?? 'textfield'));
          tab.groups.push(table); selection = { tabId: tab.id, groupId: table.id };
        } else if (action.type === 'transfer') {
          moveNativeElement(next, action.groupId, action.fieldId, destinationId, undefined, true);
          selection = { tabId: findNativeGroup(next, destinationId).tab.id, groupId: destinationId, fieldId: action.fieldId };
        } else {
          const { tab } = findNativeGroup(next, action.groupId);
          let target = destinationId;
          if (presentations.length && target === 'new') {
            const added = createNativeGroup('group', `Grupo ${tab.groups.length + 1}`);
            tab.groups.push(added); target = added.id;
          }
          convertNativeGroup(next, action.groupId, target || undefined);
          selection = { tabId: tab.id, groupId: action.groupId };
        }
      });
      if (selection) onSelect(selection);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar a estrutura.'); }
  }
  return <Dialog open onClose={onClose} title={action.type === 'table' ? 'Criar tabela' : action.type === 'convert' ? 'Converter agrupamento' : 'Transferir campo'}
    footer={<><button type="button" className={button} onClick={onClose}>Cancelar</button><button type="button" className={button} disabled={!ready} onClick={submit}>{action.type === 'table' ? 'Criar tabela' : action.type === 'convert' ? 'Converter agrupamento' : 'Transferir campo'}</button></>}>
    <div className="space-y-4">
      {action.type === 'table' ? <>
        <p className="text-sm text-slate-600">Cada coluna será um campo de resposta. Seu nome será o cabeçalho; as linhas serão adicionadas no preenchimento.</p>
        <Field label="Quantidade de colunas" hint="De 1 a 100 colunas por criação. Você pode adicionar outras depois."><TextInput aria-label="Quantidade de colunas" type="number" min={1} max={100} step={1} value={count} onChange={e => setCount(e.target.value)} /></Field>
        {!validCount && <p role="alert" className="text-sm text-red-700">Informe um número inteiro de 1 a 100.</p>}
        {validCount && Array.from({ length: columnCount }, (_, i) => <Field key={i} label={`Tipo da coluna ${i + 1}`}><Select aria-label={`Tipo da coluna ${i + 1}`} value={types[i] ?? 'textfield'}
          options={NATIVE_CATALOG.filter(c => c.category !== 'Apresentação').map(c => ({ value: c.type, label: c.label }))}
          onChange={e => setTypes(old => { const next = [...old]; next[i] = e.target.value as NativeElementType; return next; })} /></Field>)}
      </> : <>
        <p className="break-words text-sm font-medium">{source?.label}{field ? ` / ${field.label}` : ''}</p>
        {action.type === 'convert' ? <p className="text-sm text-slate-600">{source?.type === 'group' ? 'Os campos passarão a ser colunas, com uma resposta por linha.' : 'As colunas passarão a ser campos com uma única resposta.'} A conversão altera somente o rascunho. Requisições anteriores mantêm sua versão.</p>
          : <p className="text-sm text-slate-600">{source?.type === 'table' && destination?.group.type === 'table' ? 'O campo passará a se repetir nas linhas da tabela de destino, sem relação entre as linhas das duas tabelas.' : source?.type === 'table' ? 'Ao mover para um Grupo Padrão, o campo terá uma única resposta em vez de uma resposta por linha.' : destination?.group.type === 'table' ? 'Ao mover para uma Tabela, o campo terá uma resposta por linha em vez de uma única resposta.' : 'Mova o campo para outro agrupamento, preservando sua identidade e configuração.'} As respostas de requisições anteriores não serão transferidas.</p>}
        {action.type === 'convert' && presentations.length > 0 && <p className="text-sm text-slate-600">{presentations.length} elemento(s) de apresentação precisam de outro Grupo Padrão. Textos, imagens e demais conteúdos serão preservados.</p>}
        {needsDestination && <Field label="Agrupamento de destino"><Select aria-label="Agrupamento de destino" value={destinationId} onChange={e => setDestinationId(e.target.value)} options={[
          { value: '', label: 'Selecione o destino' },
          ...destinations.map(({ tab, group }, i) => ({ value: group.id, label: `${tab.label} / ${group.label} (${group.type === 'table' ? 'Tabela' : 'Padrão'}) · ${i + 1}` })),
          ...(action.type === 'convert' ? [{ value: 'new', label: 'Criar novo Grupo Padrão nesta aba' }] : []),
        ]} /></Field>}
        {action.type === 'transfer' && destinations.length === 0 && <p className="text-sm text-slate-600">Crie outro agrupamento antes de transferir este campo.</p>}
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  </Dialog>;
}
