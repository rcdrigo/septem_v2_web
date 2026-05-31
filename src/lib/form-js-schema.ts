import { slugify } from '@/lib/slugify';
import type { FormGroup, FormField } from '@/lib/api/forms';

/**
 * Deriva um schema form-js a partir dos grupos/campos do nosso builder (Forms F2,
 * Decisão 2: tabelas = verdade, form-js = renderer). Usado na pré-visualização ao
 * vivo; a versão canônica (`forms.layout`) é derivada no backend no publish.
 */
export function buildFormJsSchema(groups: FormGroup[], fields: FormField[]): unknown {
  const named = fields.filter((f) => f.name.trim());
  const byGroup = new Map<string, FormField[]>();
  const ungrouped: FormField[] = [];
  for (const f of named) {
    const gk = f.groupKey ? slugify(groupNameOf(groups, f.groupKey)) : '';
    if (gk) (byGroup.get(gk) ?? byGroup.set(gk, []).get(gk)!).push(f);
    else ungrouped.push(f);
  }

  const components: unknown[] = [];
  for (const g of groups.filter((x) => x.name.trim())) {
    const gk = slugify(g.name);
    const inner = (byGroup.get(gk) ?? []).map(toComponent);
    components.push({ id: `grp_${gk}`, type: 'group', label: g.name, showOutline: true, components: inner });
  }
  components.push(...ungrouped.map(toComponent));

  return { type: 'default', schemaVersion: 17, components };
}

function groupNameOf(groups: FormGroup[], groupKey: string): string {
  return groups.find((g) => slugify(g.name) === groupKey || g.key === groupKey)?.name ?? groupKey;
}

function toComponent(f: FormField): unknown {
  const key = slugify(f.name);
  const base: Record<string, unknown> = { id: `fld_${key}`, key, label: f.name, type: mapType(f.type) };

  const validate: Record<string, unknown> = {};
  if (f.isRequired) validate.required = true;
  if (f.minLength != null) validate.minLength = f.minLength;
  if (f.maxLength != null) validate.maxLength = f.maxLength;
  if (Object.keys(validate).length) base.validate = validate;

  if (base.type === 'select') base.values = [];
  if (f.prefix) base.prefixAdorner = f.prefix;
  if (f.suffix) base.suffixAdorner = f.suffix;
  return base;
}

function mapType(type: string): string {
  switch (type) {
    case 'textarea': return 'textarea';
    case 'number': return 'number';
    case 'checkbox': return 'checkbox';
    case 'select': return 'select';
    default: return 'textfield'; // textfield, email, datetime → textfield no preview
  }
}
