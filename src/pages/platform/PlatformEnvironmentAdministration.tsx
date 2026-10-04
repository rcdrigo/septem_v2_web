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
  smtpHost: string | null; smtpPort: number; smtpUseSsl: boolean; smtpAuthMode: string;
  smtpUser: string | null; smtpFromAddress: string | null; smtpFromName: string | null;
  smtpPasswordSet?: boolean;
};
type Delivery = { id: number; publicId: string; attempts: number; lastError: string | null };
const integrationOptions = [['email', 'Servidor de e-mail'], ['storage', 'Servidor de armazenamento'], ['openRouter', 'Provedor de IA']] as const;
const enabled = (policies: Record<string, Policy>, name: string) => {
  const key = Object.keys(policies).find(key => key.toLowerCase() === name.toLowerCase());
  return !!key && !!policies[key].visible && !!policies[key].editable;
};
const mutableSettings = (value: Settings | undefined) => {
  if (!value) return undefined;
  const { twoFactorMode: _mfa, maxLoginAttempts: _attempts, lockoutMinutes: _lockout, policies: _policies, smtpPasswordSet: _password, ...rest } = value;
  return rest;
};
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
  const [smtpDraft, setSmtpDraft] = useState<Partial<Settings> | null>(null);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpTestTo, setSmtpTestTo] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const value = draft ?? settings.data;
  const smtpValue = settings.data ? { ...settings.data, ...smtpDraft } : undefined;
  const updateEmail = (patch: Partial<Settings>) => setSmtpDraft(current => ({ ...current, ...patch }));
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
  const save = useMutation({ mutationFn: () => platformApi.put(`${base}/settings/`, mutableSettings(value)), onSuccess: async () => {
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
  const saveEmail = useMutation({ mutationFn: () => platformApi.put(`${base}/settings/`, {
      ...mutableSettings(settings.data), ...smtpDraft, smtpPassword: smtpPassword || null, smtpTestTo,
    }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: key }); setSmtpDraft(null); setSmtpPassword(''); setNotice('SMTP testado e ativado neste ambiente.'); },
      onError: (error) => setNotice(error instanceof ApiError ? (error.body as { detail?: string })?.detail || 'O teste do SMTP falhou. A configuração anterior foi mantida.' : 'Não foi possível testar e ativar o SMTP.') });
  return <div className="mt-8 space-y-8">
    {notice && <p role="status" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">{notice}</p>}
    <section aria-labelledby="environment-settings-title">
      <h2 id="environment-settings-title" className="font-semibold text-slate-900">Parâmetros do ambiente</h2>
      <p className="mt-1 text-sm text-slate-500">As alterações se aplicam somente a este ambiente.</p>
      {settings.isLoading && <p className="mt-3 text-sm">Carregando parâmetros…</p>}
      {settings.isError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar os parâmetros.</p>}
      {value && <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); const calendarProblem = validateBusinessHours(businessHoursFromSettings(value))[0]; const locationChanged = ['stateCode', 'cityCode', 'cityName', 'timeZoneId'].some(field => value[field as keyof Settings] !== settings.data?.[field as keyof Settings]); const locationProblem = (locationChanged || !!settings.data?.cityCode) ? validateCalendarLocation(value) : null; if (calendarProblem || locationProblem) { setNotice(calendarProblem || locationProblem || 'Confira o calendário.'); return; } setNotice(''); save.mutate(); }}><fieldset disabled={save.isPending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {(['logoUrl', 'heroImageUrl', 'systemDescription'] as const).map((field, i) => <label key={field} className="space-y-1 text-sm">
            <span>{['URL do logo', 'URL da imagem de destaque', 'Descrição do sistema'][i]}</span>
            <input className={input} value={value[field] ?? ''} onChange={e => update({ [field]: e.target.value })} />
          </label>)}
          <label className="space-y-1 text-sm"><span>Limite de upload (MB)</span><input type="number" required min={1} className={input} value={value.maxUploadMb} onChange={e => update({ maxUploadMb: Number(e.target.value) })} /></label>
        </div>
        <section className="space-y-3 border-t border-slate-200 pt-5">
          <h3 className="font-semibold text-slate-900">Horas úteis deste ambiente</h3>
          <p className="text-sm text-slate-600">A edição vale somente para novos cálculos neste ambiente. Vencimentos já calculados são preservados.</p>
          <BusinessHoursEditor value={businessHoursFromSettings(value)} onChange={businessHours => update({ businessHours })} />
        </section>
        <CalendarLocationFields value={value} onChange={update} required={!!value.stateCode || !!value.cityCode} />
        {!value.cityCode && <p className="text-sm text-amber-800">Processos somente podem ser iniciados após configurar estado, município, fuso e horário de funcionamento.</p>}
        {clientId && <div className="grid gap-4 sm:grid-cols-2">{(['logo', 'hero'] as const).map(kind => <label key={kind} className="space-y-1 text-sm"><span>{kind === 'logo' ? 'Enviar logo' : 'Enviar imagem de destaque'}</span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={uploading} className="block w-full min-w-0 text-sm" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(kind, file); e.target.value = ''; }} /></label>)}</div>}
        <button className={button} disabled={save.isPending || uploading || !draft}>{save.isPending ? 'Salvando…' : 'Salvar parâmetros'}</button>
      </fieldset></form>}
    </section>
    {smtpValue && <section aria-labelledby="smtp-settings-title">
        <h2 id="smtp-settings-title" className="font-semibold text-slate-900">Servidor de e-mail</h2>
        <p className="mt-1 text-sm text-slate-600">Usado por notificações e autenticação. O servidor candidato será testado antes da ativação; uma falha mantém a configuração anterior.</p>
        <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); setNotice(''); saveEmail.mutate(); }}><fieldset disabled={saveEmail.isPending || save.isPending} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(['smtpHost', 'smtpUser', 'smtpFromAddress', 'smtpFromName'] as const).map((field, i) => <label key={field} className="space-y-1 text-sm"><span>{['Servidor (host)', 'Usuário SMTP', 'E-mail remetente', 'Nome remetente'][i]}</span><input type={field === 'smtpFromAddress' ? 'email' : 'text'} className={input} value={smtpValue[field] ?? ''} onChange={e => updateEmail({ [field]: e.target.value || null })} /></label>)}
            <label className="space-y-1 text-sm"><span>Porta SMTP</span><input type="number" required min={1} max={65535} className={input} value={smtpValue.smtpPort} onChange={e => updateEmail({ smtpPort: Number(e.target.value) })} /></label>
            <label className="space-y-1 text-sm"><span>Autenticação SMTP</span><select className={input} value={smtpValue.smtpAuthMode} onChange={e => updateEmail({ smtpAuthMode: e.target.value })}><option value="login">Login</option><option value="plain">Plain</option><option value="none">Sem autenticação</option></select></label>
            <label className="space-y-1 text-sm"><span>Senha SMTP</span><input type="password" autoComplete="new-password" className={input} value={smtpPassword} placeholder="Em branco mantém a senha atual" onChange={e => setSmtpPassword(e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Destino do teste de e-mail</span><input type="email" required className={input} value={smtpTestTo} onChange={e => setSmtpTestTo(e.target.value)} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smtpValue.smtpUseSsl} onChange={e => updateEmail({ smtpUseSsl: e.target.checked })} />Usar TLS/SSL</label>
          <button className={button} disabled={saveEmail.isPending}>{saveEmail.isPending ? 'Testando SMTP…' : 'Testar e ativar SMTP'}</button>
        </fieldset></form>
      </section>}
      {value && <fieldset disabled={savePolicies.isPending || !environment.data} aria-labelledby="settings-policies-title" className="space-y-4">
        <h2 id="settings-policies-title" className="font-semibold text-slate-900">Configurações permitidas ao cliente</h2>
        <p className="text-sm text-slate-600">Desmarcar oculta a aba e impede alterações, mantendo a configuração e o serviço ativos. Identidade e calendário permanecem editáveis.</p>
        {integrationOptions.map(([name, label]) => <label key={name} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={enabled(policies, name)} onChange={e => updatePolicies(Object.fromEntries(integrationOptions.map(([key]) => [key, { visible: key === name ? e.target.checked : enabled(policies, key), editable: key === name ? e.target.checked : enabled(policies, key) }]))) } />{label}</label>)}
        <button type="button" className={button} disabled={!policyDraft || savePolicies.isPending} onClick={() => { setNotice(''); savePolicies.mutate(); }}>Salvar permissões</button>
      </fieldset>}
      <p className="text-sm text-slate-600">Autenticação em dois fatores obrigatória para todos os usuários. A política de segurança não pode ser editada.</p>
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
