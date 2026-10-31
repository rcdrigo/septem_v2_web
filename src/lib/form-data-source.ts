import { INPUT_TYPES, type FormComponent } from '@/lib/form-validation';

/** Targets come from the mounted schema; a source cannot create arbitrary form fields. */
export function applyDataSourceFields({ components, fields, scope = '', set, setScoped }: {
  components: FormComponent[];
  fields: Record<string, unknown> | null | undefined;
  scope?: string;
  set: (key: string, value: unknown) => void;
  setScoped: (scope: string, key: string, value: unknown) => void;
}) {
  if (!fields) return;
  const mappedFields = fields;
  function walk(nodes: FormComponent[], table?: string) {
    for (const node of nodes) {
      if (node.key && Object.hasOwn(mappedFields, node.key) && INPUT_TYPES.has(node.type ?? '')) {
        const value = mappedFields[node.key];
        if (!table) set(node.key, value);
        else if (scope.startsWith(`${table}.`)) setScoped(scope, node.key, value);
      }
      if (node.components) walk(node.components, node.nativeTable || node.type === 'dynamiclist' ? node.key : table);
    }
  }
  walk(components);
}
