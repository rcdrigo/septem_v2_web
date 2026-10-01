import { CalendarLocationFields } from '@/components/business-calendar/CalendarLocationFields';
import { validateBusinessHours } from '@/components/business-calendar/business-hours';
import { businessHoursFromSettings, validateCalendarLocation, type CalendarLocation } from '@/lib/business-calendar';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import { useCreateClient, useFeatureCatalog } from '@/lib/api/platform-clients';
import type { CatalogInventoryItem } from '@/lib/api/platform-catalog';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';
import { ClientInitialSettingsFields, type InitialEnvironmentSettings, type InitialEnvironmentSecrets } from './ClientInitialSettingsFields';
import { ClientCatalogSelector, type CatalogSelection } from './ClientCatalogSelector';

type Defaults = { displayName: string; primaryColor: string; initialSettings: InitialEnvironmentSettings;
  storage: { sharedConfigured: boolean; bucketName: string | null; region: string | null; endpoint: string | null } };
type Availability = { available: boolean; production: { tenantId: string; host: string; dbName: string; errors: string[] }; staging: Availability['production'] | null };
const steps = ['Cliente e identidade', 'Ambientes', 'Parâmetros e acesso', 'Funcionalidades e catálogo', 'Administração e revisão'];
const input = 'min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50';
const secondary = 'min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40';

export function PlatformNovoClientePage() {
  useDocumentTitle('Novo cliente · área central');
  const navigate = useNavigate();
  const create = useCreateClient();
  const features = useFeatureCatalog();
  const defaults = useQuery({ queryKey: ['platform', 'provisioning-defaults'], queryFn: () => platformApi.get<Defaults>('/provisioning-defaults') });
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [location, setLocation] = useState<CalendarLocation>({});
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('');
  const [settings, setSettings] = useState<InitialEnvironmentSettings | null>(null);
  const [secrets, setSecrets] = useState<InitialEnvironmentSecrets>({});
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [staging, setStaging] = useState(true);
  const [dummy, setDummy] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[] | null>(null);
  const [selectedCatalogProcesses, setSelectedCatalogProcesses] = useState<Record<string, CatalogSelection>>({});
  const [managed, setManaged] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const slug = slugOverride ?? suggestSlug(name);
  const selected = selectedFeatures ?? (features.data?.items.filter(f => f.implemented).map(f => f.key) ?? []);
  const [checkedAddress, setCheckedAddress] = useState<{ key: string; value: Availability } | null>(null);
  const [checking, setChecking] = useState(false);
  const addressKey = JSON.stringify([name.trim(), slug, staging]);
  const availability = checkedAddress?.key === addressKey ? checkedAddress.value : null;
  useEffect(() => {
    if (!defaults.data) return;
    setSettings(current => current ?? { ...defaults.data.initialSettings, policies: defaults.data.initialSettings.policies ?? {}, storageMode: 'shared', s3BucketName: null, s3Region: null, s3Endpoint: null, s3AccessKey: null });
    setDisplayName(current => current || defaults.data.displayName);
    setColor(current => current || defaults.data.primaryColor);
  }, [defaults.data]);

  async function upload(kind: 'logo' | 'hero', file: File) {
    setError(null); setUploading(kind);
    try {
      const body = new FormData(); body.append('file', file);
      const result = await platformApi.post<{ url: string }>(`/brand-assets/${kind}`, undefined, { body });
      setSettings(current => current ? { ...current, [kind === 'logo' ? 'logoUrl' : 'heroImageUrl']: result.url } : current);
    } catch (e) { setError(message(e, 'Não foi possível enviar a imagem. Use PNG, JPEG, GIF ou WebP.')); }
    finally { setUploading(null); }
  }
  function toggleCatalogSelection(item: CatalogInventoryItem, checked: boolean) {
    const selectionId = catalogSelectionKey(item.tenantId, item.key);
    setSelectedCatalogProcesses(current => {
      if (!checked) {
        const next = { ...current };
        delete next[selectionId];
        return next;
      }
      const duplicateKey = Object.values(current).some(selection =>
        selection.processKey.toLowerCase() === item.key.toLowerCase()
        && (selection.sourceTenantId.toLowerCase() !== item.tenantId.toLowerCase()
          || selection.version !== item.version),
      );
      if (duplicateKey || (current[selectionId] && current[selectionId].version !== item.version)) return current;
      return {
        ...current,
        [selectionId]: {
          sourceTenantId: item.tenantId,
          processKey: item.key,
          version: item.version,
          clientName: item.clientName,
          environmentName: item.environmentName,
          purpose: item.purpose,
          processName: item.name,
        },
      };
    });
  }
  async function checkAddress() {
    setError(null); setChecking(true);
    try {
      const query = new URLSearchParams({ name: name.trim(), slug, staging: String(staging) });
      const value = await platformApi.get<Availability>(`/provisioning-availability?${query}`);
      setCheckedAddress({ key: addressKey, value });
      return value.available;
    } catch (e) { setError(message(e, 'Não foi possível verificar os endereços. Tente novamente.')); return false; }
    finally { setChecking(false); }
  }
  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const locationProblem = validateCalendarLocation(location);
    if (locationProblem) { setStep(0); setError(locationProblem); return; }
    if (step === 1 && !(availability?.available || await checkAddress())) return;
    if (step === 2 && settings) {
      const problem = settings.storageMode === 'shared' && !defaults.data?.storage.sharedConfigured
        ? 'O armazenamento padrão da Septem ainda não está configurado. Configure-o na plataforma ou informe um bucket dedicado no grupo Armazenamento.'
        : validateSettings(settings, secrets);
      if (problem) { setError(problem); return; }
    }
    if (step === 3) {
      const keys = Object.values(selectedCatalogProcesses).map(selection => selection.processKey.toLowerCase());
      if (new Set(keys).size !== keys.length) { setError('Escolha somente uma origem para cada chave de processo.'); return; }
    }
    if (step < steps.length - 1) { setStep(step + 1); return; }
    if (!settings || !availability?.available) { setStep(1); setError('Verifique os endereços antes de cadastrar.'); return; }
    try {
      const { storageMode, ...initialSettings } = settings;
      const result = await create.mutateAsync({
        name: name.trim(), primaryColor: color, managedBySeptem: managed,
        ...location, businessHours: businessHoursFromSettings(settings),
        adminName: managed ? undefined : adminName.trim(), adminEmail: managed ? undefined : adminEmail.trim(),
        initialSettings: { ...initialSettings, ...(storageMode === 'shared' ? { s3BucketName: undefined, s3Region: undefined, s3Endpoint: undefined, s3AccessKey: undefined } : {}) }, initialSecrets: { ...secrets, ...(storageMode === 'shared' ? { s3SecretKey: undefined } : {}) }, features: selected,
        initialProcessSelections: Object.values(selectedCatalogProcesses).map(({ sourceTenantId, processKey, version }) => ({ sourceTenantId, processKey, version })),
        production: { tenantId: slug, displayName: displayName.trim(), seedDummyData: false },
        staging: staging ? { tenantId: `hml-${slug}`, displayName: displayName.trim(), seedDummyData: dummy } : null,
      });
      navigate(routes.platformClient(result.clientId));
    } catch (e) {
      setError(message(e, 'Não foi possível cadastrar. Seus dados foram preservados; confira os campos e tente novamente.'));
      if (e instanceof ApiError) {
        const body = e.body as { fieldErrors?: Record<string, string[]> } | undefined;
        if (body?.fieldErrors?.production || body?.fieldErrors?.staging) { setStep(1); setCheckedAddress(null); }
      }
    }
  }
  if (defaults.isLoading || (defaults.data && !settings)) return <p className="py-8 text-sm text-slate-600">Carregando os padrões de cadastro…</p>;
  if (defaults.isError || !settings || !defaults.data) return <section className="max-w-3xl"><h1 className="text-xl font-semibold">Novo cliente</h1><p role="alert" className="my-4 text-sm text-red-700">Não foi possível carregar os padrões da plataforma. Confira a conexão com a API.</p><button className={secondary} onClick={() => void defaults.refetch()}>Tentar novamente</button></section>;
  const busy = create.isPending || checking || uploading !== null;
  return <section className="max-w-5xl">
    <Link to={routes.platformClients} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft size={16} />Clientes</Link>
    <h1 className="text-xl font-semibold text-slate-900">Novo cliente</h1>
    <p className="mt-1 max-w-3xl text-sm text-slate-600">Defina a identidade, os ambientes e a configuração inicial do cliente. Produção e homologação começam iguais e podem ser alteradas separadamente depois.</p>
    <ol className="my-6 flex flex-wrap gap-x-5 gap-y-3 border-b border-slate-200 pb-4" aria-label="Etapas do cadastro" data-testid="assistente-etapas">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><button type="button" disabled={index > step || busy} onClick={() => setStep(index)} className={`inline-flex min-h-8 items-center gap-2 text-sm ${step === index ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{index < step ? <Check size={16} /> : <span className="tabular-nums">{index + 1}.</span>}{title}</button></li>)}</ol>
    {error && <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <form onSubmit={event => void next(event)}><fieldset disabled={busy} className="min-w-0 space-y-6">
      {step === 0 && <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
        <div className="space-y-5">
          <Field label="Nome do cliente"><input required minLength={2} maxLength={200} name="name" value={name} onChange={e => setName(e.target.value)} className={input} autoFocus /></Field>
          <CalendarLocationFields value={location} onChange={setLocation} />
          <Field label="Nome exibido no ambiente"><input required maxLength={200} name="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} className={input} /></Field>
          <Field label="Descrição do sistema"><textarea name="systemDescription" rows={3} value={settings.systemDescription ?? ''} onChange={e => setSettings({ ...settings, systemDescription: e.target.value })} className={input} /></Field>
          <Field label="Cor principal"><div className="flex gap-2"><input aria-label="Selecionar cor principal" type="color" value={color} onChange={e => setColor(e.target.value)} className="h-11 w-14 rounded border border-slate-300 bg-white p-1" /><input required pattern="#[0-9a-fA-F]{6}" aria-label="Código da cor principal" value={color} onChange={e => setColor(e.target.value)} className={input} /></div></Field>
          {(['logo', 'hero'] as const).map(kind => <div key={kind} className="space-y-2"><Field label={kind === 'logo' ? 'Logo do cliente' : 'Imagem de destaque'}><input aria-label={kind === 'logo' ? 'Enviar logo' : 'Enviar imagem de destaque'} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-slate-700" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(kind, file); e.target.value = ''; }} /></Field><button type="button" onClick={() => setSettings({ ...settings, [kind === 'logo' ? 'logoUrl' : 'heroImageUrl']: defaults.data.initialSettings[kind === 'logo' ? 'logoUrl' : 'heroImageUrl'] })} className="text-sm text-slate-600 underline underline-offset-4">Usar padrão da Septem</button></div>)}
          {uploading && <p role="status" className="flex items-center gap-2 text-sm"><Upload size={16} />Enviando imagem…</p>}
        </div>
        <aside className="self-start overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Prévia da identidade"><div className="relative min-h-64 bg-slate-900 p-7 text-white" style={settings.heroImageUrl ? { backgroundImage: `linear-gradient(#0f172abf, #0f172abf), url("${settings.heroImageUrl}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}>{settings.logoUrl && <img src={settings.logoUrl} alt="Logo do ambiente" className="mb-8 h-14 max-w-48 object-contain object-left" />}<h2 className="text-xl font-semibold">{displayName || 'Septem Compliance'}</h2><p className="mt-3 text-sm text-slate-200">{settings.systemDescription}</p><div className="mt-7 h-1 w-12" style={{ backgroundColor: color }} /></div><p className="p-4 text-sm text-slate-600">Identidade inicial dos dois ambientes. A imagem personalizada substitui o fundo institucional da Septem.</p></aside>
      </div>}
      {step === 1 && <div className="max-w-3xl space-y-6"><h2 className="text-base font-semibold">Endereços dos ambientes</h2><Field label="Subdomínio de produção"><div className="flex min-w-0 flex-wrap items-center gap-2"><input required name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={55} value={slug} onChange={e => setSlugOverride(e.target.value.toLowerCase())} className={`${input} sm:flex-1 sm:w-auto`} /><span className="text-sm text-slate-600">.septemcompliance.com</span></div></Field><p className="text-sm text-slate-600">Sugerido pelo nome do cliente. Depois da publicação, a troca de endereço exige uma operação específica.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={staging} onChange={e => setStaging(e.target.checked)} className="mt-1" /><span>Criar ambiente de homologação<span className="mt-1 block break-all text-slate-500">https://hml-{slug || 'cliente'}.septemcompliance.com</span></span></label>{staging && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={dummy} onChange={e => setDummy(e.target.checked)} />Incluir dados fictícios somente na homologação</label>}<p className="text-sm text-slate-600">Os endereços são reservados juntos. Os bancos e as pastas de arquivos são gerados automaticamente, separados por ambiente.</p><button type="button" className={secondary} onClick={() => void checkAddress()}>Verificar disponibilidade</button>{availability && <div role="status" className={`space-y-2 rounded-md border p-4 text-sm ${availability.available ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}><p className="font-medium">{availability.available ? 'Endereços disponíveis' : 'Há conflitos nos endereços'}</p>{[availability.production, availability.staging].filter(x => x !== null).map(env => <div key={env.tenantId}><p className="break-all">{env.host}</p>{env.errors.map(problem => <p key={problem}>{problem}</p>)}</div>)}</div>}</div>}
      {step === 2 && <ClientInitialSettingsFields value={settings} onChange={setSettings} secrets={secrets} onSecretsChange={setSecrets} storageDefaults={defaults.data.storage} />}
      {step === 3 && <div className="space-y-8">
        <section>
          <h2 className="font-semibold">Funcionalidades contratadas</h2>
          <p className="mt-1 text-sm text-slate-600">A seleção inicial vale para produção e homologação.</p>
          {features.isLoading && <p className="mt-3 text-sm">Carregando funcionalidades…</p>}
          {features.isError && <p role="alert" className="mt-3 text-sm text-red-700">Falha ao carregar funcionalidades. <button type="button" className="underline" onClick={() => void features.refetch()}>Tentar novamente</button></p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">{features.data?.items.map(f => <li key={f.key}><label className={`flex items-start gap-3 text-sm ${f.implemented ? 'text-slate-800' : 'text-slate-500'}`}><input type="checkbox" disabled={!f.implemented} checked={selected.includes(f.key)} onChange={() => setSelectedFeatures(selected.includes(f.key) ? selected.filter(k => k !== f.key) : [...selected, f.key])} className="mt-1" /><span>{f.name}{!f.implemented && <span className="block text-xs">Indisponível</span>}</span></label></li>)}</ul>
        </section>
        <section className="border-t border-slate-200 pt-6">
          <ClientCatalogSelector selections={selectedCatalogProcesses} onToggle={toggleCatalogSelection} />
        </section>
      </div>}
      {step === 4 && <div className="space-y-7"><section className="space-y-4"><h2 className="font-semibold">Administração do cliente</h2><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={managed} onChange={e => setManaged(e.target.checked)} className="mt-1" /><span>Administrado pela Septem<span className="mt-1 block text-slate-600">Não cria administrador do cliente. A equipe Septem mantém o acesso conforme suas concessões.</span></span></label>{!managed && <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do administrador"><input required name="adminName" value={adminName} onChange={e => setAdminName(e.target.value)} className={input} /></Field><Field label="E-mail do administrador"><input required type="email" name="adminEmail" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className={input} /></Field><p className="text-sm text-slate-600 sm:col-span-2">O convite permite definir a própria senha e acessar os ambientes do cliente. Nenhuma senha compartilhada será criada.</p></div>}</section><section className="border-t border-slate-200 pt-6"><h2 className="font-semibold">Revise antes de provisionar</h2><dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]"><dt className="text-slate-600">Cliente</dt><dd>{name}</dd><dt className="text-slate-600">Localização e fuso</dt><dd>{location.cityName} / {location.stateCode} · {location.timeZoneId}</dd><dt className="text-slate-600">Nome do ambiente</dt><dd>{displayName}</dd><dt className="text-slate-600">Produção</dt><dd className="break-all">https://{slug}.septemcompliance.com</dd><dt className="text-slate-600">Homologação</dt><dd className="break-all">{staging ? `https://hml-${slug}.septemcompliance.com${dummy ? ' · com dados fictícios' : ''}` : 'Não criar'}</dd><dt className="text-slate-600">Armazenamento</dt><dd>{settings.s3BucketName ? `Bucket dedicado: ${settings.s3BucketName}` : 'Bucket compartilhado da Septem'} · arquivos separados por ambiente</dd><dt className="text-slate-600">Funcionalidades</dt><dd>{selected.length} selecionadas</dd><dt className="text-slate-600">Processos</dt><dd>{Object.values(selectedCatalogProcesses).map(selection => `${selection.processName} v${selection.version} — ${selection.clientName} · ${purposeName(selection.purpose)}`).join(', ') || 'Nenhum selecionado'}</dd><dt className="text-slate-600">Políticas dos parâmetros</dt><dd>{Object.keys(settings.policies ?? {}).length} regras configuradas</dd><dt className="text-slate-600">Configuração inicial</dt><dd>Mesmos valores nos ambientes criados; alterações posteriores independentes.</dd></dl><p className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">O acompanhamento mostra banco, configuração, armazenamento, DNS e HTTPS. O ambiente fica pronto após as verificações. Em caso de falha, a operação preserva o que já foi criado e permite retomar.</p></section></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><button type="button" disabled={step === 0 || busy} onClick={() => { setError(null); setStep(step - 1); }} className={secondary}>Voltar</button><button type="submit" disabled={busy || (step === 3 && !features.data)} className={primary}>{busy && <Loader2 size={16} className="animate-spin" />}{step === 4 ? 'Cadastrar e provisionar' : 'Avançar'}{step < 4 && <ArrowRight size={16} />}</button></div>
    </fieldset></form>
  </section>;
}
function catalogSelectionKey(tenantId: string, processKey: string) { return JSON.stringify([tenantId.toLowerCase(), processKey.toLowerCase()]); }
function purposeName(purpose: string) { const value = purpose.toLowerCase(); return value === 'staging' ? 'Homologação' : value === 'demo' || value === 'demonstration' ? 'Demonstração' : 'Produção'; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>; }
function suggestSlug(name: string) { return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55).replace(/-+$/g, ''); }
function message(error: unknown, fallback: string) { if (error instanceof ApiError) { const body = error.body as { detail?: string; fieldErrors?: Record<string, string[]> } | undefined; return [body?.detail, ...Object.values(body?.fieldErrors ?? {}).flat()].filter(Boolean).join(' ') || fallback; } return fallback; }

function validateSettings(settings: InitialEnvironmentSettings, secrets: InitialEnvironmentSecrets): string | null {
  const calendarProblem = validateBusinessHours(businessHoursFromSettings(settings))[0];
  if (calendarProblem) return `No grupo Geral: ${calendarProblem}`;
  if (settings.maxLoginAttempts < 3 || settings.lockoutMinutes < 1 || settings.maxUploadMb < 1) return 'Confira os limites de segurança e upload: os valores devem ser positivos e permitir ao menos três tentativas de login.';
  if (settings.storageMode === 'dedicated' && (!settings.s3BucketName?.trim() || !settings.s3AccessKey?.trim() || !secrets.s3SecretKey?.trim())) return 'No grupo Armazenamento, informe bucket, chave de acesso e chave secreta para usar armazenamento dedicado.';
  if (settings.smtpPort < 1 || settings.smtpPort > 65535) return 'No grupo E-mail, informe uma porta entre 1 e 65535.';
  if (settings.smtpFromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.smtpFromAddress)) return 'No grupo E-mail, informe um endereço de remetente válido.';
  if (settings.s3UrlExpirationMinutes < 1 || settings.openRouterMaxTokens < 1) return 'A validade das URLs e o limite de tokens devem ser maiores que zero.';
  return null;
}
