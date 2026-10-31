import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { DataSourceOption, FieldOptionsResponse } from '@/lib/api/data-sources';
import type { FormComponent } from '@/lib/form-validation';

export type SourceStatus = { pending?: boolean; waiting?: string[]; error?: string; empty?: boolean };
type Binding = { path: string; scope: string; field: FormComponent; context: Record<string, unknown> };
type Entry = { source: string; dependencies?: string[]; signature: string; pending: boolean; mappedKeys?: string[] };

function bindings(nodes: FormComponent[], data: Record<string, unknown>, root = data, scope = ''): Binding[] {
  return nodes.flatMap(field => {
    if ((field.nativeTable || field.type === 'dynamiclist') && field.key) {
      const rows = data[field.key];
      return (Array.isArray(rows) ? rows : []).flatMap((row, i) => row && typeof row === 'object' && !Array.isArray(row)
        ? bindings(field.components ?? [], row, root, `${scope}${field.key}.${i}.`) : []);
    }
    if (field.components) return bindings(field.components, data, root, scope);
    return field.key && field.properties?.septemDataSourceId ? [{ path: `${scope}${field.key}`, scope: scope.replace(/\.$/, ''), field, context: { ...root, ...data } }] : [];
  });
}

export function useFormDataSources({ components, values, suspended, readOnly, taskId, set, applyFields, setOptions }: {
  components: FormComponent[]; values: Record<string, unknown>; suspended?: boolean; readOnly?: boolean; taskId?: string;
  set: (scope: string, key: string, value: unknown) => void;
  applyFields: (fields: Record<string, unknown> | null | undefined, scope: string) => void;
  setOptions: (path: string, options: DataSourceOption[]) => void;
}) {
  const entries = useRef(new Map<string, Entry>());
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [revision, refresh] = useState(0);
  const latest = useRef({ values, components, set, applyFields, setOptions });
  latest.current = { values, components, set, applyFields, setOptions };
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (suspended || readOnly) return;
    const current = bindings(components, values);
    const signature = (dependencies: string[] | undefined, context: Record<string, unknown>) => JSON.stringify((dependencies ?? []).map(key => context[key] ?? null));
    for (const binding of current) {
      const source = binding.field.properties!.septemDataSourceId;
      const cached = entries.current.get(binding.path);
      const previous = cached?.source === source ? cached : undefined;
      const key = signature(previous?.dependencies, binding.context);
      if (previous?.source === source && previous.signature === key) continue;
      const entry: Entry = { source, signature: key, dependencies: previous?.dependencies, pending: true, mappedKeys: previous?.mappedKeys };
      entries.current.set(binding.path, entry);
      const waiting = entry.dependencies?.filter(field => binding.context[field] == null || binding.context[field] === '' || (Array.isArray(binding.context[field]) && binding.context[field].length === 0));
      setStatuses(old => ({ ...old, [binding.path]: { pending: true, waiting } }));
      // Invalidate descendants immediately, before any asynchronous response can arrive.
      if (previous?.dependencies?.length) {
        latest.current.setOptions(binding.path, []);
        if (waiting?.length && binding.context[binding.field.key!] !== '') {
          latest.current.set(binding.scope, binding.field.key!, '');
          latest.current.applyFields(Object.fromEntries((entry.mappedKeys ?? []).map(key => [key, null])), binding.scope);
        }
      }
      void api.post<FieldOptionsResponse>('/api/v1/workflow/field-options', {
        dataSourceId: source, taskId, formData: binding.context,
      }).then(response => {
        if (!alive.current || entries.current.get(binding.path) !== entry) return;
        const now = bindings(latest.current.components, latest.current.values).find(b => b.path === binding.path);
        if (!now) return;
        entry.dependencies = response.dependencies ?? [];
        if (signature(entry.dependencies, now.context) !== signature(entry.dependencies, binding.context)) {
          entry.signature = 'stale'; entry.pending = false; refresh(n => n + 1); return;
        }
        entry.signature = signature(entry.dependencies, now.context); entry.pending = false;
        const options = response.options.map(o => ({ ...o, value: String(o.value ?? ''), label: String(o.label ?? o.value ?? '') }));
        entry.mappedKeys = [...new Set(options.flatMap(o => Object.keys(o.fieldValues ?? {})))];
        latest.current.setOptions(binding.path, options);
        const waiting = response.waitingForFields ?? [];
        setStatuses(old => ({ ...old, [binding.path]: { waiting, empty: !waiting.length && !options.length } }));
        const isTable = response.sourceType === 'table' || response.sourceType === 'fixed-table';
        if (isTable && ['textfield', 'textarea'].includes(binding.field.type ?? '')) {
          const text = options.map(o => o.label).join(', ');
          if (now.context[binding.field.key!] !== text) latest.current.set(binding.scope, binding.field.key!, text);
          latest.current.applyFields(response.fieldValues, binding.scope);
        } else if (isTable && now.context[binding.field.key!] != null && now.context[binding.field.key!] !== '') {
          const selected = now.context[binding.field.key!];
          if (Array.isArray(selected)) {
            const valid = selected.filter(v => options.some(o => o.value === String(v)));
            if (valid.length !== selected.length) latest.current.set(binding.scope, binding.field.key!, valid);
          } else if (!options.some(o => o.value === String(selected))) {
            latest.current.set(binding.scope, binding.field.key!, '');
            latest.current.applyFields(Object.fromEntries((previous?.mappedKeys ?? []).map(key => [key, null])), binding.scope);
          }
        }
      }).catch(error => {
        if (!alive.current || entries.current.get(binding.path) !== entry) return;
        entry.pending = false;
        setStatuses(old => ({ ...old, [binding.path]: { error: error instanceof Error ? error.message : 'Não foi possível carregar os resultados. Reabra o formulário para tentar novamente.' } }));
      });
    }
    const paths = new Set(current.map(b => b.path));
    for (const path of entries.current.keys()) if (!paths.has(path)) entries.current.delete(path);
    setStatuses(old => Object.keys(old).some(path => !paths.has(path)) ? Object.fromEntries(Object.entries(old).filter(([path]) => paths.has(path))) : old);
  }, [components, values, suspended, readOnly, taskId, revision]);
  return statuses;
}
