import { NATIVE_FIELD_TYPES, type NativeFormDefinition, type NativeConfig, type NativeField, type NativeGroup, type NativePresentation, type NativeTab } from './native-form';

export type NativeElement = NativeField | NativePresentation;
export type NativeElementType = NativeElement['type'];
export const NATIVE_CATALOG: { type: NativeElementType; label: string; category: string }[] = [
  { type: 'textfield', label: 'Texto', category: 'Entrada' },
  { type: 'textarea', label: 'Área de texto', category: 'Entrada' },
  { type: 'number', label: 'Número', category: 'Entrada' },
  { type: 'datetime', label: 'Data / Hora', category: 'Entrada' },
  { type: 'filepicker', label: 'Upload de arquivo', category: 'Entrada' },
  { type: 'select', label: 'Lista', category: 'Seleção' },
  { type: 'radio', label: 'Opções', category: 'Seleção' },
  { type: 'checkbox', label: 'Caixa de seleção', category: 'Seleção' },
  { type: 'checklist', label: 'Múltipla escolha', category: 'Seleção' },
  { type: 'taglist', label: 'Tags', category: 'Seleção' },
  { type: 'text', label: 'Texto estático', category: 'Apresentação' },
  { type: 'html', label: 'HTML', category: 'Apresentação' },
  { type: 'image', label: 'Imagem', category: 'Apresentação' },
  { type: 'separator', label: 'Separador', category: 'Apresentação' },
  { type: 'spacer', label: 'Espaçador', category: 'Apresentação' },
];
export const hasOptions = (type: string) => ['select', 'radio', 'checklist', 'taglist'].includes(type);
const responseType = (type: NativeElementType): type is NativeField['type'] => NATIVE_FIELD_TYPES.some(t => t === type);
const key = (prefix: string, id: string) => `${prefix}_${id.replaceAll('-', '_')}`;

export function createNativeGroup(type: NativeGroup['type'], label: string): NativeGroup {
  const id = crypto.randomUUID();
  return type === 'table' ? { id, label, type, key: key('tabela', id), fields: [] } : { id, label, type, fields: [] };
}
export function createNativeTab(label: string): NativeTab {
  return { id: crypto.randomUUID(), label, groups: [createNativeGroup('group', 'Grupo 1')] };
}
export function createNativeElement(type: NativeElementType): NativeElement {
  const id = crypto.randomUUID(), label = NATIVE_CATALOG.find(item => item.type === type)!.label;
  return responseType(type)
    ? { id, label, type, kind: 'field', key: '', config: hasOptions(type) ? { values: [] } : {} }
    : { id, label, type, kind: 'presentation', config: {} };
}

/** Compatibility belongs to the target type. Identity and key never follow the label. */
export function changeNativeElementType(field: NativeElement, type: NativeElementType): NativeElement {
  if ((field.kind === 'field') !== responseType(type)) throw new Error('Campos de resposta e apresentação têm identidades distintas.');
  if (field.type === type) return structuredClone(field);
  const source = field.config ?? {}, config: NativeConfig = {};
  const copy = (names: string[]) => { for (const name of names) if (source[name] !== undefined) config[name] = structuredClone(source[name]); };
  copy(['description', 'visible', 'layout', 'appearance', 'width', 'archived']);
  if (field.kind === 'field') copy(['disabled', 'readonly', 'readOnly']);
  if (['textfield', 'textarea', 'number'].includes(type)) copy(['placeholder']);
  if (['textfield', 'textarea'].includes(type) && ['textfield', 'textarea'].includes(field.type)) copy(['defaultValue']);
  if (['select', 'radio'].includes(type) && ['select', 'radio'].includes(field.type)) copy(['defaultValue']);
  if (['checklist', 'taglist'].includes(type) && ['checklist', 'taglist'].includes(field.type)) copy(['defaultValue']);
  if (['textfield', 'number', 'datetime', 'select', 'radio', 'checklist', 'taglist', 'text', 'image'].includes(type)) copy(['dataSourceId']);
  if (hasOptions(type) && hasOptions(field.type)) copy(['values', 'valuesKey']);
  const oldValidate = source.validate;
  if (oldValidate && typeof oldValidate === 'object' && !Array.isArray(oldValidate)) {
    const validate: NativeConfig = {};
    for (const name of ['required', ...(['textfield', 'textarea'].includes(type) && ['textfield', 'textarea'].includes(field.type) ? ['minLength', 'maxLength', 'pattern'] : [])]) {
      if (oldValidate[name] !== undefined) validate[name] = oldValidate[name];
    }
    if (Object.keys(validate).length) config.validate = validate;
  }
  const oldProps = source.properties;
  if (oldProps && typeof oldProps === 'object' && !Array.isArray(oldProps)) {
    const properties: NativeConfig = {};
    const names = ['septemHelpType', 'septemHelpText', 'septemVisReport', 'septemVisRequester', 'septemWidth', 'septemEvents'];
    if (['textfield', 'number', 'datetime', 'select', 'radio', 'checklist', 'taglist', 'text', 'image'].includes(type)) names.push('septemDataSourceId');
    if (['textfield', 'textarea'].includes(type) && ['textfield', 'textarea'].includes(field.type)) names.push('septemMaskId', 'septemMaskRegex', 'septemMaskTemplate', 'septemMaskValidate');
    for (const name of names) if (oldProps[name] !== undefined) properties[name] = oldProps[name];
    config.properties = properties;
  }
  return { ...field, type, config } as NativeElement;
}

/** Adapt only the existing property widgets; the persisted definition remains native. */
export function nativePanelField(field: NativeElement) {
  return { ...field.config, id: field.id, type: field.type, label: field.label,
    ...(field.kind === 'field' ? { key: field.key } : {}), dateLabel: field.label, timeLabel: field.label };
}

export function editNativeElement(field: NativeElement, path: string[], value: unknown): NativeElement {
  const next = structuredClone(field);
  if (path.length === 1 && path[0] === 'label') next.label = String(value).slice(0, 240);
  else if (path.length === 1 && path[0] === 'key' && next.kind === 'field') next.key = String(value);
  else {
    if (path.some(p => ['__proto__', 'constructor', 'prototype'].includes(p)) || !path.length) throw new Error('Propriedade inválida.');
    if (['id', 'key', 'type', 'kind'].includes(path[0])) throw new Error('A identidade do campo é permanente.');
    let target: Record<string, unknown> = next.config ??= {};
    for (const part of path.slice(0, -1)) target = (target[part] ??= {}) as Record<string, unknown>;
    if (value === undefined) delete target[path.at(-1)!];
    else target[path.at(-1)!] = value;
    // Property widgets use undefined to remove optional properties.
    next.config = JSON.parse(JSON.stringify(next.config));
  }
  return next;
}


/** Mutate only a draft supplied by the editor's update transaction. */
export function findNativeGroup(definition: NativeFormDefinition, groupId: string) {
  for (const tab of definition.tabs) {
    const group = tab.groups.find(g => g.id === groupId);
    if (group) return { tab, group };
  }
  throw new Error('Agrupamento não encontrado.');
}

export function createNativeTable(label: string, types: NativeElementType[]): NativeGroup {
  if (!types.length || types.some(type => !responseType(type))) throw new Error('Escolha ao menos uma coluna de resposta.');
  const group = createNativeGroup('table', label);
  group.fields = types.map(type => createNativeElement(type)) as NativeField[];
  return group;
}

export function canDragNativeElement(source: NativeGroup, destination: NativeGroup): boolean {
  return source.id === destination.id || (source.type === 'group' && destination.type === 'group');
}

/** beforeId names an insertion boundary; omission appends, including in empty groups. */
export function moveNativeElement(definition: NativeFormDefinition, sourceId: string, fieldId: string, destinationId: string, beforeId?: string, explicit = false) {
  const source = findNativeGroup(definition, sourceId).group;
  const destination = findNativeGroup(definition, destinationId).group;
  const index = source.fields.findIndex(f => f.id === fieldId);
  if (index < 0) throw new Error('Campo não encontrado.');
  const field = source.fields[index];
  if (!explicit && !canDragNativeElement(source, destination)) throw new Error('Use Transferir campo para mudar a cardinalidade.');
  if (destination.type === 'table' && field.kind !== 'field') throw new Error('Elementos de apresentação precisam de um Grupo Padrão.');
  if (beforeId !== undefined && !destination.fields.some(f => f.id === beforeId)) throw new Error('Posição de destino não encontrada.');
  if (source === destination && beforeId === fieldId) return;
  source.fields.splice(index, 1);
  const position = beforeId === undefined ? destination.fields.length : destination.fields.findIndex(f => f.id === beforeId);
  if (destination.type === 'table') {
    if (field.kind === 'field') destination.fields.splice(position, 0, field);
  } else destination.fields.splice(position, 0, field);
}

/** Presentation relocation and conversion are one atomic draft operation. */
export function convertNativeGroup(definition: NativeFormDefinition, groupId: string, presentationDestination?: string) {
  const { tab, group } = findNativeGroup(definition, groupId);
  const index = tab.groups.findIndex(g => g.id === groupId);
  if (group.type === 'table') {
    const { key: _key, ...node } = group;
    tab.groups[index] = { ...node, type: 'group' };
    return;
  }
  const presentation = group.fields.filter(f => f.kind === 'presentation');
  let destination: NativeGroup | undefined;
  if (presentation.length) {
    if (!presentationDestination) throw new Error('Escolha um Grupo Padrão para os elementos de apresentação.');
    destination = findNativeGroup(definition, presentationDestination).group;
    if (destination.id === group.id || destination.type !== 'group') throw new Error('Escolha outro Grupo Padrão.');
  }
  const usedKeys = new Set(definition.tabs.flatMap(t => t.groups.flatMap(g => [
    ...(g.type === 'table' ? [g.key] : []), ...g.fields.flatMap(f => f.kind === 'field' ? [f.key] : []),
  ])));
  let tableKey = key('tabela', group.id).slice(0, 120);
  while (usedKeys.has(tableKey)) tableKey = key('tabela', crypto.randomUUID());
  if (destination?.type === 'group') destination.fields.push(...presentation);
  tab.groups[index] = { ...group, type: 'table', key: tableKey, fields: group.fields.filter((f): f is NativeField => f.kind === 'field') };
}
