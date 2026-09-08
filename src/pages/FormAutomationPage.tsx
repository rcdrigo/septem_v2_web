import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { AutomationEditor } from '@/components/form/AutomationEditor';
import { useSessionStore } from '@/stores/session';
export function FormAutomationPage() {
  const [params, setParams] = useSearchParams();
  const key = params.get('process');
  const can = useSessionStore(s => s.can('forms:javascript'));
  const [processes, setProcesses] = useState<{ key: string; name: string }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { if (can) api.get<{ key: string; name: string }[]>('/api/v1/form-automations').then(setProcesses).catch(e => setError(e.message)); }, [can]);
  if (!can) return <p role="alert" className="p-6">Você não tem permissão para customizar JavaScript.</p>;
  return <main className="overflow-auto p-6">{key ? <AutomationEditor key={key} processKey={key} onClose={() => setParams({})} /> : <><h1 className="mb-4 text-lg font-semibold">JavaScript dos formulários</h1>{error && <p role="alert">{error}</p>}<ul className="divide-y rounded border bg-white">{processes.map(p => <li key={p.key}><button className="w-full p-3 text-left hover:bg-slate-50" onClick={() => setParams({ process: p.key })}>{p.name} <span className="text-xs text-slate-500">{p.key}</span></button></li>)}</ul></>}</main>;
}
