import { BusinessHoursEditor } from '@/components/business-calendar/BusinessHoursEditor';
import { CalendarLocationFields } from '@/components/business-calendar/CalendarLocationFields';
import { validateBusinessHours } from '@/components/business-calendar/business-hours';
import { businessHoursFromSettings, validateCalendarLocation, type BusinessHoursWeek, type CalendarLocation } from '@/lib/business-calendar';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';
import { ApiError } from '@/lib/api';
import { usePlatformEnvironment } from '@/lib/api/platform-clients';

type Policy = { visible: boolean; editable: boolean };
type Settings = CalendarLocation & {
  expectedVersion: number;
  businessHours?: BusinessHoursWeek | null;
  logoUrl: string | null; heroImageUrl: string | null; systemDescription: string | null;
  businessHourStart: number; businessHourEnd: number; businessDays: string;
  twoFactorMode: string; maxLoginAttempts: number; lockoutMinutes: number; maxUploadMb: number;
  policies: Record<string, Policy> | null;
};
type Delivery = { id: number; publicId: string; attempts: number; lastError: string | null };
const tabs = [['general', 'Geral'], ['email', 'E-mail'], ['storage', 'Armazenamento'], ['security', 'Segurança'], ['public', 'Área pública'], ['openRouter', 'Inteligência artificial']];
const fields: Record<string, string[]> = {
  general: ['clienteNome', 'ambienteNome', 'logoUrl', 'primaryColor', 'heroImageUrl', 'systemDescription', 'businessHours', 'stateCode', 'cityCode', 'timeZoneId'],
  email: ['host', 'port', 'useSsl', 'authMode', 'user', 'passwordSet', 'fromAddress', 'fromName'],
  storage: ['maxUploadMb', 'bucketName', 'region', 'endpoint', 'accessKey', 'secretKeySet', 'baseFolder', 'cdnUrl', 'useSignedUrls', 'urlExpirationMinutes', 'storageClass', 'encryption', 'blockedExtensions'],
  security: ['twoFactorMode', 'maxLoginAttempts', 'lockoutMinutes'],
  public: ['turnstileSiteKey', 'turnstileSecret', 'portalUrl'], openRouter: ['apiKeySet', 'model'],
};
const labels: Record<string, string> = { clienteNome: 'Nome do cliente', ambienteNome: 'Nome do ambiente', logoUrl: 'Logo', primaryColor: 'Cor principal', heroImageUrl: 'Imagem de destaque', systemDescription: 'Descrição', businessHours: 'Horas úteis', stateCode: 'Estado', cityCode: 'Município', timeZoneId: 'Fuso horário', businessHourStart: 'Início do expediente', businessHourEnd: 'Fim do expediente', businessDays: 'Dias úteis', host: 'Servidor', port: 'Porta', useSsl: 'Usar TLS', authMode: 'Autenticação', user: 'Usuário', passwordSet: 'Senha', fromAddress: 'E-mail remetente', fromName: 'Nome remetente', bucketName: 'Bucket', region: 'Região', endpoint: 'Endereço do serviço', accessKey: 'Chave de acesso', secretKeySet: 'Chave secreta', baseFolder: 'Pasta base', cdnUrl: 'URL da CDN', useSignedUrls: 'URLs assinadas', urlExpirationMinutes: 'Validade da URL', storageClass: 'Classe de armazenamento', encryption: 'Criptografia', maxUploadMb: 'Limite de upload', blockedExtensions: 'Extensões bloqueadas', twoFactorMode: 'Autenticação em dois fatores', maxLoginAttempts: 'Tentativas de login', lockoutMinutes: 'Tempo de bloqueio', turnstileSiteKey: 'Chave pública do captcha', turnstileSecret: 'Chave secreta do captcha', portalUrl: 'URL do portal', apiKeySet: 'Chave da API', model: 'Modelo padrão' };
const policyLabel = (path: string) => { const [tab, field] = path.split('.'); return `${tabs.find(([key]) => key === tab)?.[1] ?? tab}${field ? ` — ${labels[field] ?? field}` : ''}`; };
const input = 'min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50';
const button = 'min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50';

export function PlatformEnvironmentAdministration({ tenantId, clientId }: { tenantId: string; clientId?: string | null }) {
  const base = `/environments/${encodeURIComponent(tenantId)}`;
  const cache = useQueryClient();
  const key = ['platform', 'environment-settings', tenantId];
  const settings = useQuery({ queryKey: key, queryFn: () => platformApi.get<Settings>(`${base}/settings/`) });
  const environment = usePlatformEnvironment(tenantId);
  const [policyVersion, setPolicyVersion] = useState<number | null>(null);
  const queueKey = ['platform', 'suspended-deliveries', tenantId];
  const deliveries = useQuery({ queryKey: queueKey, queryFn: () => platformApi.get<{ items: Delivery[] }>(`${base}/suspended-deliveries/`) });
  const [draft, setDraft] = useState<Settings | null>(null);
  const [policyDraft, setPolicyDraft] = useState<Record<string, Policy> | null>(null);
  const [path, setPath] = useState('general');
  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const value = draft ?? settings.data;
  const policies = policyDraft ?? settings.data?.policies ?? {};
  const update = (patch: Partial<Settings>) => setDraft(current => { const baseValue = current ?? settings.data; return baseValue ? { ...baseValue, ...patch } : current; });
  async function upload(kind: 'logo' | 'hero', file: File) {
    if (!clientId) return;
    setUploading(true); setNotice('');
    try {
      const body = new FormData(); body.append('file', file);
      const result = await platformApi.post<{ url: string }>(`/clients/${clientId}/brand-assets/${kind}`, undefined, { body });
      update(kind === 'logo' ? { logoUrl: result.url } : { heroImageUrl: result.url });
      setNotice('Imagem enviada. Salve os parâmetros para publicá-la neste ambiente.');
    } catch { setNotice('Não foi possível enviar a imagem. Use PNG, JPEG, GIF ou WebP.'); }
    finally { setUploading(false); }
  }
  const save = useMutation({ mutationFn: () => platformApi.put(`${base}/settings/`, value), onSuccess: async () => {
    await cache.invalidateQueries({ queryKey: key }); setDraft(null); setNotice('Parâmetros salvos neste ambiente.');
  }, onError: (error) => setNotice(error instanceof ApiError && error.status === 409
    ? 'Os parâmetros foram alterados por outra pessoa. Recarregue a página antes de editar novamente.'
    : 'Não foi possível salvar os parâmetros. Confira os valores e tente novamente.') });
  const savePolicies = useMutation({ mutationFn: () => platformApi.put(`${base}/settings/policies`, {
    policies, expectedVersion: policyVersion,
  }), onSuccess: async () => {
    await Promise.all([cache.invalidateQueries({ queryKey: key }), cache.invalidateQueries({ queryKey: ['platform', 'environments', tenantId] })]);
    setPolicyDraft(null); setPolicyVersion(null); setNotice('Permissões dos parâmetros salvas.');
  }, onError: (error) => setNotice(error instanceof ApiError && error.status === 409
    ? 'O ambiente foi alterado por outra pessoa. Recarregue a página antes de editar as permissões novamente.'
    : 'Não foi possível salvar as permissões.') });
  const resume = useMutation({ mutationFn: () => platformApi.post<{ resumed: number }>(`${base}/suspended-deliveries/resume`, { ids: selected }), onSuccess: async (r) => {
    await cache.invalidateQueries({ queryKey: queueKey }); setSelected([]); setNotice(`${r.resumed} mensagem(ns) autorizada(s) para retomada.`);
  }, onError: () => setNotice('Não foi possível retomar. Confirme que o cliente e o ambiente estão ativos.') });
  const updatePolicies = (next: Record<string, Policy>) => {
    if (!policyDraft) setPolicyVersion(environment.data?.version ?? null);
    setPolicyDraft(next);
  };
  const setPolicy = (name: string, patch: Partial<Policy>) => updatePolicies({ ...policies, [name]: { ...(policies[name] ?? { visible: true, editable: true }), ...patch } });
  return <div className="mt-8 space-y-8">
    {notice && <p role="status" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">{notice}</p>}
    <section aria-labelledby="environment-settings-title">
      <h2 id="environment-settings-title" className="font-semibold text-slate-900">Parâmetros do ambiente</h2>
      <p className="mt-1 text-sm text-slate-500">As alterações se aplicam somente a este ambiente.</p>
      {settings.isLoading && <p className="mt-3 text-sm">Carregando parâmetros…</p>}
      {settings.isError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar os parâmetros.</p>}
      {value && <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); const calendarProblem = validateBusinessHours(businessHoursFromSettings(value))[0]; const locationChanged = ['stateCode', 'cityCode', 'cityName', 'timeZoneId'].some(field => value[field as keyof Settings] !== settings.data?.[field as keyof Settings]); const locationProblem = locationChanged ? validateCalendarLocation(value) : null; if (calendarProblem || locationProblem) { setNotice(calendarProblem || locationProblem || 'Confira o calendário.'); return; } setNotice(''); save.mutate(); }}><fieldset disabled={save.isPending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {(['logoUrl', 'heroImageUrl', 'systemDescription'] as const).map((field, i) => <label key={field} className="space-y-1 text-sm">
            <span>{['URL do logo', 'URL da imagem de destaque', 'Descrição do sistema'][i]}</span>
            <input className={input} value={value[field] ?? ''} onChange={e => update({ [field]: e.target.value })} />
          </label>)}
          {(['maxLoginAttempts', 'lockoutMinutes', 'maxUploadMb'] as const).map((field, i) => <label key={field} className="space-y-1 text-sm">
            <span>{['Máximo de tentativas de login', 'Bloqueio após tentativas (minutos)', 'Limite de upload (MB)'][i]}</span>
            <input type="number" required min={i === 0 ? 3 : 1} className={input} value={value[field]} onChange={e => update({ [field]: Number(e.target.value) })} />
          </label>)}
          <label className="space-y-1 text-sm"><span>Autenticação em dois fatores</span><select className={input} value={value.twoFactorMode} onChange={e => update({ twoFactorMode: e.target.value })}><option value="off">Desativada</option><option value="internal">Usuários internos</option><option value="all">Todos os usuários</option></select></label>
        </div>
        <section className="space-y-3 border-t border-slate-200 pt-5">
          <h3 className="font-semibold text-slate-900">Horas úteis deste ambiente</h3>
          <p className="text-sm text-slate-600">A edição vale somente para novos cálculos neste ambiente. Vencimentos já calculados são preservados.</p>
          <BusinessHoursEditor value={businessHoursFromSettings(value)} onChange={businessHours => update({ businessHours })} />
        </section>
        <CalendarLocationFields value={value} onChange={update} required={!!value.stateCode || !!value.cityCode} />
        {!value.cityCode && <p className="text-sm text-amber-800">Complete a localização do cliente para considerar feriados nos próximos cálculos.</p>}
        {clientId && <div className="grid gap-4 sm:grid-cols-2">{(['logo', 'hero'] as const).map(kind => <label key={kind} className="space-y-1 text-sm"><span>{kind === 'logo' ? 'Enviar logo' : 'Enviar imagem de destaque'}</span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={uploading} className="block w-full min-w-0 text-sm" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(kind, file); e.target.value = ''; }} /></label>)}</div>}
        <button className={button} disabled={save.isPending || uploading || !draft}>{save.isPending ? 'Salvando…' : 'Salvar parâmetros'}</button>
      </fieldset></form>}
    </section>
    {value && <fieldset disabled={savePolicies.isPending || !environment.data} aria-labelledby="settings-policies-title">
      <h2 id="settings-policies-title" className="font-semibold text-slate-900">Acesso do cliente aos parâmetros</h2>
      <p className="mt-1 text-sm text-slate-500">Uma aba oculta esconde seus campos. Uma aba sem edição impede alterações em todos os seus campos.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 space-y-1 text-sm"><span>Aba ou campo</span><select className={input} value={path} onChange={e => setPath(e.target.value)}>{tabs.map(([tab, label]) => <optgroup key={tab} label={label}><option value={tab}>{label} — aba inteira</option>{fields[tab].map(f => <option key={f} value={`${tab}.${f}`}>{label} — {labels[f] ?? f}</option>)}</optgroup>)}</select></label><button type="button" className={button} onClick={() => setPolicy(path, {})}>Adicionar regra</button></div>
      <ul className="mt-3 divide-y divide-slate-200">{Object.entries(policies).map(([name, policy]) => <li key={name} className="flex flex-wrap items-center gap-4 py-3 text-sm"><span className="min-w-0 flex-1 break-all">{policyLabel(name)}</span><label className="flex items-center gap-2"><input type="checkbox" checked={policy.visible} onChange={e => setPolicy(name, { visible: e.target.checked })} />Visível</label><label className="flex items-center gap-2"><input type="checkbox" checked={policy.editable} onChange={e => setPolicy(name, { editable: e.target.checked })} />Editável</label><button type="button" className="min-h-10 text-slate-600 underline" onClick={() => { const next = { ...policies }; delete next[name]; updatePolicies(next); }}>Remover regra</button></li>)}</ul>
      {!Object.keys(policies).length && <p className="my-3 text-sm text-slate-500">Nenhuma restrição adicional configurada.</p>}
      <button type="button" className={button} disabled={!policyDraft || savePolicies.isPending} onClick={() => { setNotice(''); savePolicies.mutate(); }}>Salvar permissões</button>
    </fieldset>}
    <section aria-labelledby="suspended-messages-title">
      <h2 id="suspended-messages-title" className="font-semibold text-slate-900">Mensagens suspensas</h2>
      <p className="mt-1 text-sm text-slate-500">Selecione as mensagens que devem voltar à fila. O envio exige cliente e ambiente ativos.</p>
      {deliveries.isError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar as mensagens.</p>}
      {deliveries.isLoading && <p className="mt-3 text-sm">Carregando mensagens…</p>}
      {deliveries.data && !deliveries.data.items.length && <p className="mt-3 text-sm text-slate-500">Nenhuma mensagem suspensa.</p>}
      <ul className="mt-3 divide-y divide-slate-200">{deliveries.data?.items.map(d => <li key={d.id} className="py-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={selected.includes(d.id)} onChange={e => setSelected(old => e.target.checked ? [...old, d.id] : old.filter(id => id !== d.id))} /><span className="min-w-0"><span className="block break-all">Mensagem {d.publicId}</span><span className="text-slate-500">{d.attempts} tentativa(s){d.lastError ? ` · ${d.lastError}` : ''}</span></span></label></li>)}</ul>
      {!!deliveries.data?.items.length && <button type="button" className={`${button} mt-3`} disabled={!selected.length || resume.isPending} onClick={() => { setNotice(''); resume.mutate(); }}>Retomar selecionadas ({selected.length})</button>}
    </section>
  </div>;
}
