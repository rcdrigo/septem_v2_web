import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { PLATFORM_PREFIX, platformApi } from '@/lib/platform-api';
import { useCreateClient, useFeatureCatalog } from '@/lib/api/platform-clients';
import { routes } from '@/lib/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

type BrandSettings = { logoUrl: string | null; heroImageUrl: string | null; systemDescription: string | null };
type Defaults = { displayName: string; primaryColor: string; baseDomain: string; initialSettings: BrandSettings };
type AvailabilityEnvironment = { tenantId: string; host: string; dbName: string; errors: string[] };
type Availability = { available: boolean; errors?: string[]; production: AvailabilityEnvironment; staging: AvailabilityEnvironment };
const integrationOptions = [['email', 'Servidor de e-mail'], ['storage', 'Servidor de armazenamento'], ['openRouter', 'Provedor de IA']] as const;
const steps = ['Cliente e identidade', 'Parametrização do sistema', 'Revisão'];
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
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('');
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [permissions, setPermissions] = useState({ email: false, storage: false, openRouter: false });
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[] | null>(null);
  const [managed, setManaged] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'hero' | null>(null);
  const imageInputs = useRef<Partial<Record<'logo' | 'hero', HTMLInputElement | null>>>({});
  const objectUrls = useRef<Partial<Record<'logo' | 'hero', string>>>({});
  const mounted = useRef(true);
  const [previews, setPreviews] = useState<Partial<Record<'logo' | 'hero', string>>>({});
  const [imageNames, setImageNames] = useState<Partial<Record<'logo' | 'hero', string>>>({});
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(objectUrls.current).forEach(url => URL.revokeObjectURL(url));
      objectUrls.current = {};
    };
  }, []);
  const slug = slugOverride || suggestSlug(name);
  const selected = selectedFeatures ?? (features.data?.items.filter(f => f.implemented).map(f => f.key) ?? []);
  const [checkedAddress, setCheckedAddress] = useState<{ key: string; value: Availability } | null>(null);
  const [checking, setChecking] = useState(false);
  const addressKey = JSON.stringify([name.trim(), slug]);
  const availability = checkedAddress?.key === addressKey ? checkedAddress.value : null;
  useEffect(() => {
    if (!defaults.data) return;
    setSettings(current => current ?? { logoUrl: defaults.data.initialSettings.logoUrl, heroImageUrl: defaults.data.initialSettings.heroImageUrl, systemDescription: null });
  }, [defaults.data]);

  async function upload(kind: 'logo' | 'hero', file: File) {
    if (uploading !== null) return;
    setError(null); setUploading(kind);
    try {
      const body = new FormData(); body.append('file', file);
      const result = await platformApi.post<{ url: string; previewUrl: string }>(`/brand-assets/${kind}`, undefined, { body });
      const image = await platformApi.getBlob(result.previewUrl.slice(PLATFORM_PREFIX.length));
      if (!mounted.current) return;
      const preview = URL.createObjectURL(image);
      const previous = objectUrls.current[kind];
      objectUrls.current[kind] = preview;
      setPreviews(current => ({ ...current, [kind]: preview }));
      setImageNames(current => ({ ...current, [kind]: file.name }));
      setSettings(current => current ? { ...current, [kind === 'logo' ? 'logoUrl' : 'heroImageUrl']: result.url } : current);
      if (previous) URL.revokeObjectURL(previous);
    } catch (e) { setError(message(e, 'Não foi possível enviar a imagem. Use PNG, JPEG, GIF ou WebP.')); }
    finally { setUploading(null); }
  }
  async function checkAddress() {
    setError(null); setChecking(true);
    try {
      const query = new URLSearchParams({ name: name.trim(), slug });
      const value = await platformApi.get<Availability>(`/provisioning-availability?${query}`);
      setCheckedAddress({ key: addressKey, value });
      return value.available;
    } catch (e) { setError(message(e, 'Não foi possível verificar os endereços. Tente novamente.')); return false; }
    finally { setChecking(false); }
  }
  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (!name.trim()) { setStep(0); setError('Informe o nome do cliente.'); return; }
    if (step >= 1 && (features.isLoading || features.isError || !features.data)) { setStep(1); setError('Carregue as funcionalidades antes de continuar. Tente novamente no catálogo.'); return; }
    if (step === 1 && !managed && !adminName.trim()) { setError('Informe o nome do administrador.'); return; }
    if (step === 1 && !(availability?.available || await checkAddress())) return;
    if (step < steps.length - 1) { setStep(step + 1); return; }
    if (!settings || !availability?.available) { setStep(1); setError('Verifique os endereços antes de cadastrar.'); return; }
    try {
      const result = await create.mutateAsync({
        name: name.trim(), primaryColor: color || undefined, managedBySeptem: managed,
        adminName: managed ? undefined : adminName.trim(), adminEmail: managed ? undefined : adminEmail.trim(),
        initialSettings: { ...settings, systemDescription: settings.systemDescription?.trim() || undefined,
          policies: Object.fromEntries(integrationOptions.map(([key]) => [key, { visible: permissions[key], editable: permissions[key] }])) },
        features: selected,
        production: { tenantId: slug, displayName: displayName.trim() || undefined },
        staging: { tenantId: `hml-${slug}`, displayName: displayName.trim() || undefined },
      });
      navigate(routes.platformClient(result.clientId));
    } catch (e) {
      setError(message(e, 'Não foi possível cadastrar. Seus dados foram preservados; confira os campos e tente novamente.'));
      if (e instanceof ApiError) {
        const body = e.body as { fieldErrors?: Record<string, string[]> } | undefined;
        if (body?.fieldErrors?.production || body?.fieldErrors?.staging || body?.fieldErrors?.name) { setStep(1); setCheckedAddress(null); }
      }
    }
  }
  if (defaults.isLoading || (defaults.data && !settings)) return <p className="py-8 text-sm text-slate-600">Carregando os padrões de cadastro…</p>;
  if (defaults.isError || !settings || !defaults.data) return <section className="max-w-3xl"><h1 className="text-xl font-semibold">Novo cliente</h1><p role="alert" className="my-4 text-sm text-red-700">Não foi possível carregar os padrões da plataforma. Confira a conexão com a API.</p><button className={secondary} onClick={() => void defaults.refetch()}>Tentar novamente</button></section>;
  const busy = create.isPending || checking || uploading !== null;
  const previewLogo = previews.logo ?? settings.logoUrl;
  const previewHero = previews.hero ?? settings.heroImageUrl;
  const baseDomain = defaults.data.baseDomain;
  const systemName = displayName.trim() || defaults.data.displayName;
  const description = settings.systemDescription?.trim() || defaults.data.initialSettings.systemDescription;
  return <section className="max-w-5xl">
    <Link to={routes.platformClients} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft size={16} />Clientes</Link>
    <h1 className="text-xl font-semibold text-slate-900">Novo cliente</h1>
    <p className="mt-1 max-w-3xl text-sm text-slate-600">Cadastre o cliente e personalize seu sistema. Produção e homologação serão criadas com os padrões da plataforma e configurações independentes.</p>
    <ol className="my-6 flex flex-wrap gap-x-5 gap-y-3 border-b border-slate-200 pb-4" aria-label="Etapas do cadastro" data-testid="assistente-etapas">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><button type="button" disabled={index > step || busy} onClick={() => setStep(index)} className={`inline-flex min-h-8 items-center gap-2 text-sm ${step === index ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{index < step ? <Check size={16} /> : <span className="tabular-nums">{index + 1}.</span>}{title}</button></li>)}</ol>
    {error && <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <form onSubmit={event => void next(event)}><fieldset disabled={busy} className="min-w-0 space-y-6">
      {step === 0 && <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
        <div className="space-y-5">
          <Field label="Nome do cliente"><input required maxLength={200} name="name" value={name} onChange={e => setName(e.target.value)} className={input} autoFocus /></Field>
          <Field label="Nome do sistema"><input placeholder={defaults.data.displayName} maxLength={200} name="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} className={input} /></Field>
          <Field label="Descrição do sistema"><textarea name="systemDescription" placeholder={defaults.data.initialSettings.systemDescription ?? undefined} rows={3} value={settings.systemDescription ?? ''} onChange={e => setSettings({ ...settings, systemDescription: e.target.value })} className={input} /></Field>
          <Field label="Cor principal"><div className="flex gap-2"><input aria-label="Selecionar cor principal" type="color" value={color || defaults.data.primaryColor} onChange={e => setColor(e.target.value)} className="h-11 w-14 rounded border border-slate-300 bg-white p-1" /><input placeholder={defaults.data.primaryColor} pattern="#[0-9a-fA-F]{6}" aria-label="Código da cor principal" value={color} onChange={e => setColor(e.target.value)} className={input} /></div></Field>
          {(['logo', 'hero'] as const).map(kind => <div key={kind} className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
              <label htmlFor={`brand-${kind}`}>{kind === 'logo' ? 'Logo' : 'Imagem de destaque'}</label>
              <input id={`brand-${kind}`} ref={element => { imageInputs.current[kind] = element; }} aria-label={kind === 'logo' ? 'Arquivo da logo' : 'Arquivo da imagem de destaque'} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void upload(kind, file); e.target.value = ''; }} />
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <button type="button" disabled={busy} aria-busy={uploading === kind} onClick={() => imageInputs.current[kind]?.click()} className={`${secondary} inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600`}>
                  {uploading === kind ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                  <span aria-live="polite">{uploading === kind ? (kind === 'logo' ? 'Enviando logo…' : 'Enviando imagem…') : (kind === 'logo' ? 'Enviar logo' : 'Enviar imagem de destaque')}</span>
                </button>
                <span className="min-w-0 break-all text-sm text-slate-600">{imageNames[kind] ?? 'Opcional · padrão Septem'}</span>
              </div>
            </div>)}
        </div>
        <aside className="self-start overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Prévia da identidade"><div className="relative min-h-64 bg-slate-900 p-7 text-white" style={previewHero ? { backgroundImage: `linear-gradient(#0f172abf, #0f172abf), url("${previewHero}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}>{previewLogo && <img src={previewLogo} alt="Logo do ambiente" className="mb-8 h-14 max-w-48 object-contain object-left" />}<h2 className="text-xl font-semibold">{systemName}</h2><p className="mt-3 text-sm text-slate-200">{description}</p><div className="mt-7 h-1 w-12" style={{ backgroundColor: color || defaults.data.primaryColor }} /></div><p className="p-4 text-sm text-slate-600">Sem imagens personalizadas, os dois ambientes usam a logo e o fundo institucional da Septem.</p></aside>
      </div>}
      {step === 1 && <div className="max-w-3xl space-y-8">
        <section className="space-y-4"><h2 className="font-semibold">Subdomínio</h2>
          <Field label="Subdomínio de produção"><div className="flex min-w-0 flex-wrap items-center gap-2"><input required name="slug" aria-label="Subdomínio de produção" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={55} value={slug} onChange={e => setSlugOverride(e.target.value.toLowerCase())} className={`${input} sm:flex-1 sm:w-auto`} /><span className="break-all text-sm text-slate-600">.{baseDomain}</span></div></Field>
          <p className="break-all text-sm text-slate-600">Homologação: hml-{slug || 'cliente'}.{baseDomain}</p>
          <p className="text-sm text-slate-600">O nome do cliente, os dois endereços e os bancos gerados precisam estar disponíveis.</p>
          <button type="button" className={secondary} onClick={() => void checkAddress()}>Verificar disponibilidade</button>
          {availability && <div role="status" className={`space-y-2 rounded-md border p-4 text-sm ${availability.available ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}><p className="font-medium">{availability.available ? 'Cadastro disponível' : 'Há conflitos no cadastro'}</p>{availability.errors?.map(problem => <p key={problem}>{problem}</p>)}{[availability.production, availability.staging].filter(Boolean).map(env => <div key={env.tenantId}><p className="break-all">{env.host} · banco {env.dbName}</p>{env.errors.map(problem => <p key={problem}>{problem}</p>)}</div>)}</div>}
        </section>
        <section className="border-t border-slate-200 pt-6"><h2 className="font-semibold">Funcionalidades contratadas</h2>
          <p className="mt-1 text-sm text-slate-600">Valem para os dois ambientes. Novas funcionalidades serão concedidas separadamente.</p>
          {features.isLoading && <p className="mt-3 text-sm">Carregando funcionalidades…</p>}
          {features.isError && <p role="alert" className="mt-3 text-sm text-red-700">Falha ao carregar funcionalidades. <button type="button" className="underline" onClick={() => void features.refetch()}>Tentar novamente</button></p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">{features.data?.items.map(f => <li key={f.key}><label className={`flex items-start gap-3 text-sm ${f.implemented ? 'text-slate-800' : 'text-slate-500'}`}><input type="checkbox" disabled={!f.implemented} checked={selected.includes(f.key)} onChange={() => setSelectedFeatures(selected.includes(f.key) ? selected.filter(k => k !== f.key) : [...selected, f.key])} className="mt-1" /><span>{f.name}{!f.implemented && <span className="block text-xs">Indisponível</span>}</span></label></li>)}</ul>
        </section>
        <section className="space-y-4 border-t border-slate-200 pt-6"><h2 className="font-semibold">Configurações permitidas</h2><p className="text-sm text-slate-600">Selecione as integrações que o cliente poderá editar. As demais abas ficarão ocultas, mantendo os serviços ativos.</p>
          {integrationOptions.map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={permissions[key]} onChange={e => setPermissions(current => ({ ...current, [key]: e.target.checked }))} />{label}</label>)}
          <p className="text-sm text-slate-600">Identidade e calendário estarão sempre disponíveis para edição. A permissão não altera quem paga o consumo.</p>
        </section>
        <section className="space-y-4 border-t border-slate-200 pt-6"><h2 className="font-semibold">Administração do sistema</h2><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={managed} onChange={e => setManaged(e.target.checked)} className="mt-1" /><span>Administrado pela Septem<span className="mt-1 block text-slate-600">Nenhum administrador do cliente será criado inicialmente. Você poderá convidá-lo depois.</span></span></label>{!managed && <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do administrador"><input required name="adminName" value={adminName} onChange={e => setAdminName(e.target.value)} className={input} /></Field><Field label="E-mail do administrador"><input required type="email" name="adminEmail" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className={input} /></Field><p className="text-sm text-slate-600 sm:col-span-2">O convite será enviado quando produção estiver pronta, para concluir o cadastro e definir a senha.</p></div>}</section>
      </div>}
      {step === 2 && <section><h2 className="font-semibold">Revise antes de criar</h2><dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
        <dt className="text-slate-600">Cliente</dt><dd className="break-words">{name}</dd>
        <dt className="text-slate-600">Nome do sistema</dt><dd>{systemName}</dd>
        <dt className="text-slate-600">Descrição</dt><dd>{description || 'Padrão da plataforma'}</dd>
        <dt className="text-slate-600">Cor principal</dt><dd>{color || defaults.data.primaryColor}</dd>
        <dt className="text-slate-600">Logo</dt><dd>{imageNames.logo || 'Padrão da plataforma'}</dd>
        <dt className="text-slate-600">Imagem de destaque</dt><dd>{imageNames.hero || 'Padrão da plataforma'}</dd>
        <dt className="text-slate-600">Produção</dt><dd className="break-all">https://{availability?.production.host} · banco {availability?.production.dbName}</dd>
        <dt className="text-slate-600">Homologação</dt><dd className="break-all">https://{availability?.staging.host} · banco {availability?.staging.dbName}</dd>
        <dt className="text-slate-600">Funcionalidades</dt><dd>{features.data?.items.filter(f => selected.includes(f.key)).map(f => f.name).join(', ') || 'Nenhuma selecionada'}</dd>
        <dt className="text-slate-600">Configurações permitidas</dt><dd>{integrationOptions.filter(([key]) => permissions[key]).map(([, label]) => label).join(', ') || 'Nenhuma integração editável'}</dd>
        <dt className="text-slate-600">Administração inicial</dt><dd>{managed ? 'Septem · sem administrador do cliente' : `${adminName} · ${adminEmail}`}</dd>
        <dt className="text-slate-600">Parâmetros iniciais</dt><dd>Padrões da plataforma preservados por ambiente.</dd>
        <dt className="text-slate-600">Calendário</dt><dd>Configurar em cada ambiente antes de iniciar processos.</dd>
        <dt className="text-slate-600">Autenticação</dt><dd>Dois fatores obrigatórios para todos os usuários.</dd>
      </dl><p className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Os dois ambientes são provisionados separadamente. Produção poderá ser utilizada assim que estiver pronta; uma falha em homologação permite retomar somente esse ambiente.</p></section>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><button type="button" disabled={step === 0 || busy} onClick={() => { setError(null); setStep(step - 1); }} className={secondary}>Voltar</button><button type="submit" disabled={busy || (step > 0 && (features.isLoading || features.isError || !features.data))} className={primary}>{(create.isPending || checking) && <Loader2 size={16} className="animate-spin" />}{step === 2 ? 'Cadastrar e provisionar' : 'Avançar'}{step < 2 && <ArrowRight size={16} />}</button></div>
    </fieldset></form>
  </section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>; }
function suggestSlug(name: string) { return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55).replace(/-+$/g, ''); }
function message(error: unknown, fallback: string) { if (error instanceof ApiError) { const body = error.body as { detail?: string; fieldErrors?: Record<string, string[]> } | undefined; return [body?.detail, ...Object.values(body?.fieldErrors ?? {}).flat()].filter(Boolean).join(' ') || fallback; } return fallback; }
