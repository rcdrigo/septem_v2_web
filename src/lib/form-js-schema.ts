import { slugify } from '@/lib/slugify';
import type { FormGroup, FormField, FormMask } from '@/lib/api/forms';

/**
 * Ponte entre o nosso modelo {grupos, campos} e o schema form-js que vive embutido
 * no BPMN (`septem:FormSchema`). A config rica que o form-js não tem (máscara,
 * fonte de dados, ajuda, visibilidade, colunas) viaja num objeto custom `septem`
 * em cada componente — o `ReactForm` (execução) e o `schemaToModel` (autoria) leem
 * de volta. Os tipos conhecidos passam direto para o `type` (o ReactForm renderiza).
 */

/** Tipos que o ReactForm sabe renderizar nativamente. */
const KNOWN_TYPES = ['textfield', 'textarea', 'number', 'checkbox', 'select', 'email', 'datetime', 'radio', 'password'];

export function buildFormJsSchema(groups: FormGroup[], fields: FormField[], masks: FormMask[] = []): unknown {
  const maskById = new Map(masks.map((m) => [m.id, m]));
  const named = fields.filter((f) => f.name.trim());
  const byGroup = new Map<string, FormField[]>();
  const ungrouped: FormField[] = [];
  for (const f of named) {
    const gk = f.groupKey ? slugify(groupNameOf(groups, f.groupKey)) : '';
    if (gk) (byGroup.get(gk) ?? byGroup.set(gk, []).get(gk)!).push(f);
    else ungrouped.push(f);
  }

  const toComp = (f: FormField) => toComponent(f, maskById);
  const components: unknown[] = [];
  for (const g of groups.filter((x) => x.name.trim())) {
    const gk = slugify(g.name);
    const inner = (byGroup.get(gk) ?? []).map(toComp);
    components.push({ id: `grp_${gk}`, type: 'group', label: g.name, showOutline: true, components: inner, septem: { columns: g.columns } });
  }
  components.push(...ungrouped.map(toComp));

  return { type: 'default', schemaVersion: 17, components };
}

/** Inverso: reconstrói {grupos, campos} a partir do schema embutido (autoria). */
export function schemaToModel(schema: unknown): { groups: FormGroup[]; fields: FormField[] } {
  const root = (schema as { components?: AnyComp[] } | null)?.components ?? [];
  const groups: FormGroup[] = [];
  const fields: FormField[] = [];
  let order = 0;

  const readField = (c: AnyComp, groupKey: string): FormField => {
    const s = (c.septem ?? {}) as Record<string, unknown>;
    return {
      type: (s.fieldType as string) ?? c.type ?? 'textfield',
      key: c.key ?? '',
      name: c.label ?? c.key ?? '',
      groupKey: groupKey || null,
      helpTextType: (s.helpTextType as string) ?? null,
      helpText: (s.helpText as string) ?? c.description ?? null,
      prefix: c.prefixAdorner ?? null,
      suffix: c.suffixAdorner ?? null,
      minLength: (c.validate?.minLength as number) ?? null,
      maxLength: (c.validate?.maxLength as number) ?? null,
      order: order++,
      columns: (s.columns as number) ?? 1,
      width: null,
      maskId: (s.maskId as string) ?? null,
      dataSourceId: (s.dataSourceId as string) ?? null,
      isRequired: !!c.validate?.required,
      isVisibleReport: (s.isVisibleReport as boolean) ?? true,
      isVisibleRequester: (s.isVisibleRequester as boolean) ?? true,
    };
  };

  for (const c of root) {
    if (c.type === 'group' && Array.isArray(c.components)) {
      const gk = slugify(c.label ?? '');
      const gs = (c.septem ?? {}) as Record<string, unknown>;
      groups.push({ key: gk, name: c.label ?? '', order: groups.length, columns: (gs.columns as number) ?? 1 });
      for (const child of c.components) if (child.key) fields.push(readField(child, gk));
    } else if (c.key) {
      fields.push(readField(c, ''));
    }
  }
  return { groups, fields };
}

type AnyComp = {
  id?: string; key?: string; type?: string; label?: string; description?: string;
  prefixAdorner?: string; suffixAdorner?: string;
  validate?: Record<string, unknown>;
  components?: AnyComp[];
  septem?: Record<string, unknown>;
};

function groupNameOf(groups: FormGroup[], groupKey: string): string {
  return groups.find((g) => slugify(g.name) === groupKey || g.key === groupKey)?.name ?? groupKey;
}

function toComponent(f: FormField, maskById: Map<string, FormMask>): unknown {
  const key = slugify(f.name);
  const base: Record<string, unknown> = { id: `fld_${key}`, key, label: f.name, type: mapType(f.type) };

  const validate: Record<string, unknown> = {};
  if (f.isRequired) validate.required = true;
  if (f.minLength != null) validate.minLength = f.minLength;
  if (f.maxLength != null) validate.maxLength = f.maxLength;
  if (Object.keys(validate).length) base.validate = validate;

  if (base.type === 'select' || base.type === 'radio') base.values = [];
  if (f.prefix) base.prefixAdorner = f.prefix;
  if (f.suffix) base.suffixAdorner = f.suffix;
  if (f.helpTextType !== 'popover' && f.helpText) base.description = f.helpText;

  // Resolve a máscara (snapshot do regex no save — execução não precisa buscar).
  const mask = f.maskId ? maskById.get(f.maskId) : undefined;

  // Config rica nossa (lida pelo ReactForm na execução e pelo schemaToModel na autoria).
  base.septem = {
    fieldType: f.type,
    maskId: f.maskId ?? null,
    mask: mask ? { key: mask.key, regex: mask.regex, shouldValidate: mask.shouldValidate } : null,
    dataSourceId: f.dataSourceId ?? null,
    helpText: f.helpText ?? null,
    helpTextType: f.helpTextType ?? 'inline',
    columns: f.columns ?? 1,
    isVisibleReport: f.isVisibleReport,
    isVisibleRequester: f.isVisibleRequester,
  };
  return base;
}

function mapType(type: string): string {
  return KNOWN_TYPES.includes(type) ? type : 'textfield';
}
