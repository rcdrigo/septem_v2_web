import { IconPicker } from '@/components/ui/IconPicker';
import { fetchNativeFieldUsage, type NativeFieldUsage } from '@/lib/api/forms';
import { getFormFieldEntries, setFormFieldEntries } from '@/lib/bpmn-form-fields';
import { renderIcon } from '@/lib/icon-catalog';
import { nativeReferences, invalidNativeReferences } from '@/lib/native-form-references';
import { useEffect, useRef, useState } from 'react';
import { Plus, Settings2, Trash2, Table2, Rows3, GripVertical } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { NativeStructureDialog, type StructureAction } from './NativeStructureDialog';
import { FieldConfigPanel } from './FieldConfigPanel';
import { Field, TextInput, TextArea, Switch } from '@/components/ui/Field';
import { nativeFields, type NativeFormDefinition, type NativeGroup, type NativeTab } from '@/lib/native-form';
import { canDragNativeElement, findNativeGroup, moveNativeElement, NATIVE_CATALOG, createNativeElement, createNativeGroup, createNativeTab, changeNativeElementType, editNativeElement, nativePanelField, hasOptions, type NativeElement, type NativeElementType } from '@/lib/native-form-editor';

const button = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
type Selection = { tabId: string; groupId?: string; fieldId?: string };
type Props = {
  definition: NativeFormDefinition;
  modeler?: any;
  processKey?: string | null;
  update: (change: (next: NativeFormDefinition) => void) => void;
  masks: React.ComponentProps<typeof FieldConfigPanel>['masks'];
};

export function NativeFormEditor({ definition, update, masks, modeler, processKey }: Props) {
  const [selection, setSelection] = useState<Selection>(() => ({ tabId: definition.tabs[0].id, groupId: definition.tabs[0].groups[0].id }));
  const [catalog, setCatalog] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [structureAction, setStructureAction] = useState<StructureAction | null>(null);
  const [drag, setDrag] = useState<{ groupId: string; fieldId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [checkingRemoval, setCheckingRemoval] = useState(false);
  const [removalError, setRemovalError] = useState('');
  const [blockedRemoval, setBlockedRemoval] = useState<{ usages: NativeFieldUsage[] } | null>(null);
  const currentDefinition = useRef(definition);
  currentDefinition.current = definition;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [, refreshReferences] = useState(0);
  useEffect(() => {
    const bus = modeler?.get?.('eventBus');
    const refresh = () => refreshReferences(n => n + 1);
    bus?.on('commandStack.changed', refresh);
    return () => bus?.off('commandStack.changed', refresh);
  }, [modeler]);
  const nameRef = useRef<HTMLInputElement>(null);
  const tab = definition.tabs.find(t => t.id === selection.tabId) ?? definition.tabs[0];
  const group = tab.groups.find(g => g.id === selection.groupId);
  const field = group?.fields.find(f => f.id === selection.fieldId);
  const selected = field ?? group ?? tab;
  const selectGroup = (g: NativeGroup) => setSelection({ tabId: tab.id, groupId: g.id });
  const focusProperties = () => window.requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>('[data-native-properties] input[aria-label="Nome"]')?.focus();
  });
  function editNode(change: (node: NativeTab | NativeGroup | NativeElement) => void) {
    update(next => {
      const t = next.tabs.find(t => t.id === tab.id)!;
      const g = t.groups.find(g => g.id === group?.id);
      change(field ? g!.fields.find(f => f.id === field.id)! : g ?? t);
    });
  }
  function editField(id: string, change: (field: NativeElement) => NativeElement) {
    update(next => {
      for (const t of next.tabs) for (const g of t.groups) {
        const index = g.fields.findIndex(f => f.id === id);
        if (index >= 0) {
          const changed = change(g.fields[index]);
          if (g.type === 'table' && changed.kind !== 'field') throw new Error('Tabelas aceitam somente campos de resposta.');
          g.fields[index] = changed;
        }
      }
    });
  }
  function addField(type: NativeElementType) {
    if (!group) return;
    const added = createNativeElement(type);
    update(next => {
      const destination = next.tabs.find(t => t.id === tab.id)!.groups.find(g => g.id === group.id)!;
      if (destination.type === 'table') { if (added.kind === 'field') destination.fields.push(added); }
      else destination.fields.push(added);
    });
    setCatalog(false); setSelection({ tabId: tab.id, groupId: group.id, fieldId: added.id });
    focusProperties();
  }
  function addGroup(type: NativeGroup['type']) {
    const added = createNativeGroup(type, `${type === 'table' ? 'Tabela' : 'Grupo'} ${tab.groups.length + 1}`);
    update(next => next.tabs.find(t => t.id === tab.id)!.groups.push(added));
    setNewGroup(false); setSelection({ tabId: tab.id, groupId: added.id });
    window.requestAnimationFrame(() => nameRef.current?.focus());
  }
  function acceptsDrop(destination: NativeGroup) {
    return !!drag && canDragNativeElement(findNativeGroup(definition, drag.groupId).group, destination);
  }
  function move(sourceId: string, fieldId: string, destinationId: string, beforeId?: string) {
    update(next => moveNativeElement(next, sourceId, fieldId, destinationId, beforeId));
    const destination = findNativeGroup(definition, destinationId);
    setSelection({ tabId: destination.tab.id, groupId: destinationId, fieldId });
    setNotice(`Campo reposicionado em ${destination.tab.label} / ${destination.group.label}.`);
  }
  function drop(e: React.DragEvent, destination: NativeGroup, beforeId?: string) {
    e.preventDefault(); e.stopPropagation();
    if (drag && acceptsDrop(destination)) move(drag.groupId, drag.fieldId, destination.id, beforeId);
    else setNotice('Use Transferir campo para mover entre tabelas ou entre Padrão e Tabela.');
    setDrag(null); setDropTarget(null);
  }
  async function remove(target?: { tabId: string; groupId: string; fieldId: string }) {
    if (checkingRemoval) return;
    const original = definition;
    const targetTab = target ? definition.tabs.find(t => t.id === target.tabId)! : tab;
    const targetGroup = target ? targetTab.groups.find(g => g.id === target.groupId)! : group;
    const targetField = target ? targetGroup?.fields.find(f => f.id === target.fieldId) : field;
    if (target && !targetField) return;
    const selectedFields = targetField ? [targetField] : targetGroup ? targetGroup.fields : targetTab.groups.flatMap(g => g.fields);
    const ids = new Set(selectedFields.map(f => f.id));
    setCheckingRemoval(true); setRemovalError('');
    try {
      const usage = processKey && selectedFields.some(f => f.kind === 'field') ? await fetchNativeFieldUsage(processKey) : [];
      if (!mounted.current) return;
      if (currentDefinition.current !== original) throw new Error('O formulário mudou durante a verificação. Selecione o campo e tente novamente.');
      const used = usage.filter(u => ids.has(u.fieldId) && u.executionCount > 0);
      if (used.length) {
        update(next => { for (const t of next.tabs) for (const g of t.groups) for (const f of g.fields) if (ids.has(f.id)) (f.config ??= {}).archived = true; });
        setBlockedRemoval({ usages: used });
        setNotice('Campo arquivado no rascunho. Ao publicar, deixará de aparecer nas tarefas e relatórios; as respostas serão preservadas.');
        return;
      }
      update(next => {
        const t = next.tabs.find(t => t.id === targetTab.id)!;
        if (targetField) {
          const g = t.groups.find(g => g.id === targetGroup!.id)!;
          g.fields = g.fields.filter(f => f.id !== targetField.id) as typeof g.fields;
        } else if (targetGroup && t.groups.length > 1) t.groups = t.groups.filter(g => g.id !== targetGroup.id);
        else if (!targetGroup && next.tabs.length > 1) next.tabs = next.tabs.filter(t => t.id !== targetTab.id);
      });
      // A removed, unused field has no task visibility to preserve. Other semantic
      // dependencies remain visible in the reference diagnostics for manual review.
      const keys = new Set(selectedFields.flatMap(f => f.kind === 'field' ? [f.key] : []));
      for (const element of modeler?.get?.('elementRegistry')?.getAll?.() ?? []) {
        const entries = getFormFieldEntries(element);
        const remaining = entries.filter(e => e.fieldId ? !ids.has(e.fieldId) : !keys.has(e.fieldRef));
        if (remaining.length !== entries.length) setFormFieldEntries(modeler, element, remaining);
      }
      if (targetField) setSelection({ tabId: targetTab.id, groupId: targetGroup!.id });
      else if (targetGroup) setSelection({ tabId: targetTab.id, groupId: targetTab.groups.find(g => g.id !== targetGroup.id)!.id });
      else { const nextTab = definition.tabs.find(t => t.id !== targetTab.id)!; setSelection({ tabId: nextTab.id, groupId: nextTab.groups[0].id }); }
    } catch (cause) { if (mounted.current) setRemovalError(cause instanceof Error ? cause.message : 'Não foi possível verificar as respostas. Tente excluir novamente.'); }
    finally { if (mounted.current) setCheckingRemoval(false); }
  }
  const canRemove = !!field || (group ? tab.groups.length > 1 : definition.tabs.length > 1);
  const kindLabel = field ? 'campo' : group ? 'agrupamento' : 'aba';
  const panel = field ? nativePanelField(field) : null;
  const options = field?.config?.values;
  const references = nativeReferences(modeler, definition);
  const selectedKeys = new Set((field ? [field] : group ? group.fields : tab.groups.flatMap(g => g.fields)).flatMap(f => f.kind === 'field' ? [f.key] : []));
  for (const g of group ? [group] : tab.groups) if (!field && g.type === 'table') selectedKeys.add(g.key);
  const selectedIds = new Set((field ? [field] : group ? group.fields : tab.groups.flatMap(g => g.fields)).map(f => f.id));
  const usages = references.filter(r => r.fieldId ? selectedIds.has(r.fieldId) : selectedKeys.has(r.key) || [...selectedKeys].some(key => r.key.endsWith(`[].${key}`)));
  const invalid = invalidNativeReferences(definition, references);
  // Campo sem CHAVE é descartado ao salvar (sem chave não há resposta para guardar), e
  // isso acontecia em silêncio: o usuário acrescentava o campo, salvava e ele sumia.
  // A chave nasce do NOME, então dizer "dê um nome" é a instrução útil.
  const semNome = definition.tabs.flatMap(t => t.groups.flatMap(g => g.fields
    .filter(f => f.kind === 'field' && !f.key)
    .map(f => ({ aba: t.label, grupo: g.label, campo: f.label }))));
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden" data-native-editor>
      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        {/* `role=status`, não `alert`: é orientação, não erro urgente — e um `alert` aqui
            entrava no caminho de quem espera "nenhum alerta na tela" como sinal de que não
            há problema. */}
        {semNome.length > 0 && <div role="status" data-testid="campos-sem-nome" className="border-b border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Dê um nome aos campos antes de salvar</p>
          <p>Campo sem nome não tem chave de resposta e <strong>não é guardado</strong> ao salvar o processo.</p>
          <ul className="mt-2 list-disc pl-5">{semNome.map((c, i) => <li key={i} className="break-words">{c.aba} · {c.grupo}: {c.campo || 'campo sem nome'}</li>)}</ul>
        </div>}
        {invalid.length > 0 && <div role="alert" className="border-b border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Corrija as referências antes de publicar</p><p>O rascunho pode ser salvo.</p><ul className="mt-2 list-disc pl-5">{invalid.map((r, i) => <li key={i} className="break-words">{r.owner} · {r.use}: {r.key}</li>)}</ul></div>}
        <nav aria-label="Abas do formulário" className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3">
          {definition.tabs.map(t => <button type="button" key={t.id} onDragEnter={() => { if (drag) setSelection({ tabId: t.id, groupId: t.groups[0].id }); }}
            onDragOver={e => { if (drag) e.preventDefault(); }} aria-current={t.id === tab.id ? 'page' : undefined}
            className={`${button} aria-[current=page]:border-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white aria-[current=page]:hover:bg-slate-800`}
            onClick={() => { setSelection({ tabId: t.id, groupId: t.groups[0].id }); setCatalog(false); }}>{renderIcon(typeof t.config?.icon === 'string' ? t.config.icon : undefined, 16)}{t.label || 'Aba sem nome'}</button>)}
          <button type="button" className={button} onClick={() => {
            const added = createNativeTab(`Aba ${definition.tabs.length + 1}`);
            update(next => next.tabs.push(added)); setSelection({ tabId: added.id });
            window.requestAnimationFrame(() => nameRef.current?.focus());
          }}><Plus size={16} /> Nova aba</button>
        </nav>
        <p role="status" className="px-4 pt-2 text-sm text-slate-600">{notice || 'Arraste pela alça para ordenar. Para mover entre abas, mantenha o campo sobre a aba de destino.'}</p>
        {removalError && <p role="alert" className="px-4 pt-2 text-sm text-red-700">{removalError}</p>}
        <div className="space-y-5 bg-slate-50 p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={button} onClick={() => { setSelection({ tabId: tab.id }); window.requestAnimationFrame(() => nameRef.current?.focus()); }}><Settings2 size={16} /> Configurar aba</button>
            <button type="button" className={button} onClick={() => setNewGroup(true)}><Plus size={16} /> Novo agrupamento</button>
          </div>
          {tab.groups.map(g => <section key={g.id} aria-label={g.label || 'Agrupamento sem nome'} data-group-id={g.id}
            onDragOver={e => { if (acceptsDrop(g)) { e.preventDefault(); setDropTarget(g.id); } }}
            onDrop={e => drop(e, g)}
            className={`rounded-lg border bg-white ${dropTarget === g.id ? 'border-blue-700 ring-2 ring-blue-700' : g.id === group?.id ? 'border-slate-700 ring-1 ring-slate-700' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
              <button type="button" aria-pressed={g.id === group?.id && !field} className="flex min-w-0 items-center gap-2 rounded p-1 text-left focus-visible:outline-2"
                onClick={() => { selectGroup(g); window.requestAnimationFrame(() => nameRef.current?.focus()); }}>
                {g.type === 'table' ? <Table2 size={18} /> : <Rows3 size={18} />}
                <span className="break-words font-semibold text-slate-900">{g.label || 'Agrupamento sem nome'}</span>
                <span className="text-xs text-slate-600">{g.type === 'table' ? 'Tabela' : 'Padrão'}</span>
              </button>
              <button type="button" className={button} aria-label={`Adicionar campo em ${g.label}`} onClick={() => { selectGroup(g); setCatalog(true); }}><Plus size={16} /> Adicionar campo</button>
            </div>
            {typeof g.config?.description === 'string' && <p className="px-4 pt-3 text-sm text-slate-600">{g.config.description}</p>}
            {g.fields.length === 0 ? <p className="p-5 text-sm text-slate-600">{g.type === 'table' ? 'Adicione campos para definir as colunas desta tabela.' : 'Adicione o primeiro campo deste agrupamento.'}</p>
              : <div className="divide-y divide-slate-100">{g.fields.map(f => <div key={f.id} data-field-id={f.id} className="flex items-stretch"
                onDragOver={e => { e.stopPropagation(); if (acceptsDrop(g)) { e.preventDefault(); setDropTarget(f.id); } }} onDrop={e => drop(e, g, f.id)}>
                <button type="button" draggable aria-label={`Mover ${f.label}`} title="Arraste para mover; use as setas para ordenar pelo teclado."
                  className="cursor-grab px-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 active:cursor-grabbing"
                  onClick={() => { setSelection({ tabId: tab.id, groupId: g.id, fieldId: f.id }); }}
                  onKeyDown={e => {
                    const index = g.fields.findIndex(item => item.id === f.id);
                    if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); move(g.id, f.id, g.id, g.fields[index - 1].id); }
                    if (e.key === 'ArrowDown' && index < g.fields.length - 1) { e.preventDefault(); move(g.id, f.id, g.id, g.fields[index + 2]?.id); }
                  }}
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.id); setDrag({ groupId: g.id, fieldId: f.id }); setNotice('Solte antes de um campo ou no agrupamento para inserir ao final.'); }}
                  onDragEnd={() => { setDrag(null); setDropTarget(null); }}><GripVertical size={16} /></button>
                <button type="button" aria-pressed={f.id === field?.id}
                className={`flex min-w-0 w-full flex-wrap ${dropTarget === f.id ? 'border-t-2 border-blue-700' : ''} items-center justify-between gap-2 px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${f.id === field?.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                onClick={() => { setSelection({ tabId: tab.id, groupId: g.id, fieldId: f.id }); focusProperties(); }}>
                <span className="min-w-0 break-words text-sm font-medium text-slate-900">{f.label || 'Sem nome'}</span>
                <span className="text-xs text-slate-600">{NATIVE_CATALOG.find(item => item.type === f.type)?.label}{f.config?.archived === true ? ' · Arquivado' : f.config?.visible === false ? ' · Oculto' : ''}</span>
              </button>
              <button type="button" aria-label={`Excluir campo ${f.label || 'sem nome'}`} title="Excluir campo"
                disabled={checkingRemoval} onClick={() => void remove({ tabId: tab.id, groupId: g.id, fieldId: f.id })}
                className="shrink-0 self-center rounded-md p-2 text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={16} aria-hidden="true" /></button>
              </div>)}</div>}
          </section>)}
        </div>
      </div>
      <aside aria-label="Propriedades da seleção" data-native-properties className="w-full shrink-0 border-t border-slate-200 bg-white lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
        {!field && <div className="space-y-3 border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">{group ? 'Configurações do agrupamento' : 'Configurações da aba'}</h2>
          <p className="break-words text-xs text-slate-600">{tab.label}{group ? ` / ${group.label}` : ''}</p>
          {!field && <Field label="Nome"><TextInput ref={nameRef} maxLength={240} value={selected.label} onChange={e => editNode(n => { n.label = e.target.value; })} /></Field>}
          {!group && !field && <Field label="Ícone da aba"><IconPicker catalog="all" value={typeof tab.config?.icon === 'string' ? tab.config.icon : undefined} onChange={icon => editNode(n => { if (icon) (n.config ??= {}).icon = icon; else if (n.config) delete n.config.icon; })} /></Field>}
          <Field label="Descrição"><TextArea value={String(selected.config?.description ?? '')} onChange={e => editNode(n => { (n.config ??= {}).description = e.target.value; })} /></Field>
          <Switch label="Visível" checked={selected.config?.visible !== false} onChange={v => editNode(n => { (n.config ??= {}).visible = v; })} />
          {group && !field && <button type="button" className={button} onClick={() => setStructureAction({ type: 'convert', groupId: group.id })}>Converter para {group.type === 'group' ? 'Tabela' : 'Padrão'}</button>}
          <button type="button" className={`${button} text-red-700`} disabled={!canRemove || checkingRemoval} onClick={() => void remove()}><Trash2 size={15} /> {checkingRemoval ? 'Verificando respostas…' : `Excluir ${kindLabel}`}</button>
          {!canRemove && <p className="text-xs text-slate-600">{group ? 'Cada aba precisa de pelo menos um agrupamento.' : 'O formulário precisa de pelo menos uma aba.'}</p>}
        </div>}
        {field && panel && <>
          {hasOptions(field.type) && <div className="space-y-2 border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold">Opções da lista</h3>
            {Array.isArray(options) && options.map((option, index) => {
              if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
              const changeOption = (key: string, value: string) => editField(field.id, f => editNativeElement(f, ['values'], options.map((o, i) => i === index ? { ...option, [key]: value } : o)));
              return <div key={index} className="space-y-2 border-b border-slate-200 pb-3">
                <Field label={`Rótulo da opção ${index + 1}`}><TextInput value={String(option.label ?? '')} onChange={e => changeOption('label', e.target.value)} /></Field>
                <Field label={`Valor da opção ${index + 1}`}><TextInput value={String(option.value ?? '')} onChange={e => changeOption('value', e.target.value)} /></Field>
                <button type="button" className={button} onClick={() => editField(field.id, f => editNativeElement(f, ['values'], options.filter((_, i) => i !== index)))}>Remover opção {index + 1}</button>
              </div>;
            })}
            <button type="button" className={button} onClick={() => editField(field.id, f => editNativeElement(f, ['values'], [...(Array.isArray(options) ? options : []), { label: 'Nova opção', value: crypto.randomUUID() }]))}>Adicionar opção</button>
          </div>}
          <FieldConfigPanel key={`${field.id}:${field.type}`} native field={panel} masks={masks}
            nativeTypeOptions={NATIVE_CATALOG.filter(item => (item.category === 'Apresentação') === (field.kind === 'presentation')).map(item => ({ value: item.type, label: item.label }))}
            onNativeTypeChange={type => editField(field.id, f => changeNativeElementType(f, type as NativeElementType))}
            availableFields={nativeFields(definition).filter(f => !!f.field.key).map(f => ({ id: f.path, label: f.field.label }))}
            editField={(target, path, value) => editField(target.id, f => editNativeElement(f, path, value))} />
        </>}
        {field && <div className="space-y-3 border-t border-slate-200 p-4">
          {group && <button type="button" className={button} onClick={() => setStructureAction({ type: 'transfer', groupId: group.id, fieldId: field.id })}>Transferir campo</button>}
          {usages.length > 0 && <section aria-label="Usos conhecidos" className="space-y-1 text-sm text-slate-700"><h3 className="font-semibold">Usos conhecidos</h3><p>Revise estes usos ao excluir, alterar o tipo, transferir ou mudar a chave.</p><ul className="list-disc pl-5">{usages.map((r, i) => <li key={i} className="break-words">{r.owner} · {r.use}: {r.key}</li>)}</ul></section>}
          {field.kind === 'field' && field.config?.archived === true && <p className="text-sm text-slate-600">Campo arquivado. Após a publicação, não será exibido nas tarefas nem nos relatórios; as respostas serão preservadas.</p>}
        </div>}
      </aside>
      {blockedRemoval && <Dialog open title="Não é possível excluir" onClose={() => setBlockedRemoval(null)} width="sm">
        <p className="text-sm text-slate-700">Estes campos já possuem execuções e não podem ser excluídos. Foram arquivados no rascunho. Ao publicar, deixarão de aparecer nas tarefas e nos relatórios; as respostas serão preservadas.</p>
        <ul className="my-4 list-disc space-y-1 pl-5 text-sm">{blockedRemoval.usages.map(u => <li key={u.fieldId} className="break-words">{u.label} — {u.executionCount} {u.executionCount === 1 ? 'requisição' : 'requisições'}</li>)}</ul>
        <button type="button" className={button} onClick={() => setBlockedRemoval(null)}>Entendi</button>
      </Dialog>}
      {newGroup && <Dialog open title="Novo agrupamento" onClose={() => setNewGroup(false)} width="sm">
        <p className="mb-4 text-sm text-slate-600">Escolha como organizar os campos em {tab.label}.</p>
        <div className="flex flex-col gap-3"><button type="button" className={button} onClick={() => addGroup('group')}><Rows3 size={18} /> Padrão</button><button type="button" className={button} onClick={() => { setNewGroup(false); setStructureAction({ type: 'table', tabId: tab.id }); }}><Table2 size={18} /> Tabela</button></div>
      </Dialog>}
      {structureAction && <NativeStructureDialog action={structureAction} definition={definition} update={update} onClose={() => setStructureAction(null)} onSelect={setSelection} />}
      {catalog && group && <Dialog open title="Adicionar campo" onClose={() => setCatalog(false)} width="md">
        <p className="mb-4 break-words text-sm text-slate-600">Destino: {tab.label} / <strong>{group.label}</strong></p>
        {['Entrada', 'Seleção', ...(group.type === 'group' ? ['Apresentação'] : [])].map(category => {
          const items = NATIVE_CATALOG.filter(item => item.category === category);
          return items.length > 0 && <section key={category} className="mt-4"><h3 className="mb-2 text-sm font-semibold">{category}</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{items.map(item => <button type="button" className={`${button} justify-start`} key={item.type} onClick={() => addField(item.type)}>{item.label}</button>)}</div></section>;
        })}
      </Dialog>}
    </div>
  );
}
