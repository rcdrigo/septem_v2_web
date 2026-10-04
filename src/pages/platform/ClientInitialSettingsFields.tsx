import { BusinessHoursEditor, type BusinessHoursWeek } from '@/components/business-calendar/BusinessHoursEditor';
import { businessHoursFromSettings } from '@/lib/business-calendar';
import { useId, useState } from 'react';

export type InitialPolicy = { visible: boolean; editable: boolean };

/** Snapshot não secreto aplicado aos ambientes no provisionamento inicial. */
export type InitialEnvironmentSettings = {
  logoUrl: string | null;
  heroImageUrl: string | null;
  systemDescription: string | null;
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: string;
  businessHours?: BusinessHoursWeek | null;
  twoFactorMode: 'off' | 'internal' | 'all';
  maxLoginAttempts: number;
  lockoutMinutes: number;
  maxUploadMb: number;
  smtpHost: string | null;
  smtpPort: number;
  smtpUseSsl: boolean;
  smtpAuthMode: string;
  smtpUser: string | null;
  smtpFromAddress: string | null;
  smtpFromName: string | null;
  s3BucketName: string | null;
  s3Region: string | null;
  s3Endpoint: string | null;
  s3AccessKey: string | null;
  s3CdnUrl: string | null;
  s3UseSignedUrls: boolean;
  s3UrlExpirationMinutes: number;
  s3StorageClass: string | null;
  s3Encryption: string | null;
  blockedExtensions: string;
  turnstileSiteKey: string | null;
  portalUrl: string | null;
  openRouterModel: string | null;
  policies: Record<string, InitialPolicy>;
  /** Estado da tela; o wizard remove esta propriedade do snapshot enviado à API. */
  storageMode: 'shared' | 'dedicated';
};

/** Segredos são submetidos à parte e nunca fazem parte do snapshot retornado pela API. */
export type InitialEnvironmentSecrets = {
  smtpPassword?: string;
  s3SecretKey?: string;
  turnstileSecret?: string;
  openRouterApiKey?: string;
};

export type SharedStorageDefaults = {
  sharedConfigured: boolean;
  bucketName: string | null;
  region: string | null;
  endpoint: string | null;
};

type Props = {
  value: InitialEnvironmentSettings;
  onChange: (value: InitialEnvironmentSettings) => void;
  storageDefaults: SharedStorageDefaults;
  secrets: InitialEnvironmentSecrets;
  onSecretsChange: (value: InitialEnvironmentSecrets) => void;
};

const tabs = [
  ['general', 'Geral'],
  ['email', 'E-mail'],
  ['storage', 'Armazenamento'],
  ['security', 'Segurança'],
  ['public', 'Área pública'],
  ['openRouter', 'Inteligência artificial'],
] as const;

const policyFields: Record<(typeof tabs)[number][0], string[]> = {
  general: ['logoUrl', 'heroImageUrl', 'systemDescription', 'businessHours', 'stateCode', 'cityCode', 'timeZoneId'],
  email: ['host', 'port', 'useSsl', 'authMode', 'user', 'passwordSet', 'fromAddress', 'fromName'],
  storage: ['maxUploadMb', 'bucketName', 'region', 'endpoint', 'accessKey', 'secretKeySet', 'cdnUrl', 'useSignedUrls', 'urlExpirationMinutes', 'storageClass', 'encryption', 'blockedExtensions'],
  security: ['twoFactorMode', 'maxLoginAttempts', 'lockoutMinutes'],
  public: ['turnstileSiteKey', 'turnstileSecret', 'portalUrl'],
  openRouter: ['apiKeySet', 'model'],
};

const fieldLabels: Record<string, string> = {
  logoUrl: 'Logo', heroImageUrl: 'Imagem de destaque', systemDescription: 'Descrição do sistema',
  businessHours: 'Horas úteis da semana', stateCode: 'Estado', cityCode: 'Município', timeZoneId: 'Fuso horário',
  businessHourStart: 'Início do expediente', businessHourEnd: 'Fim do expediente', businessDays: 'Dias úteis',
  host: 'Servidor SMTP', port: 'Porta SMTP', useSsl: 'TLS', authMode: 'Autenticação', user: 'Usuário SMTP',
  passwordSet: 'Senha SMTP', fromAddress: 'E-mail remetente', fromName: 'Nome remetente',
  maxUploadMb: 'Limite de upload', bucketName: 'Bucket', region: 'Região', endpoint: 'Endpoint',
  accessKey: 'Chave de acesso', secretKeySet: 'Chave secreta', cdnUrl: 'URL da CDN', useSignedUrls: 'URLs assinadas',
  urlExpirationMinutes: 'Validade da URL', storageClass: 'Classe de armazenamento', encryption: 'Criptografia',
  blockedExtensions: 'Extensões bloqueadas', twoFactorMode: 'Autenticação em dois fatores',
  maxLoginAttempts: 'Tentativas de login', lockoutMinutes: 'Tempo de bloqueio',
  turnstileSiteKey: 'Chave pública do captcha', turnstileSecret: 'Chave secreta do captcha', portalUrl: 'URL do portal',
  apiKeySet: 'Chave da API', model: 'Modelo padrão',
};

const inputClass = 'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500';
const buttonClass = 'min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700';
const policyLabel = (path: string) => {
  const [tab, field] = path.split('.');
  return `${tabs.find(([key]) => key === tab)?.[1] ?? tab}${field ? ` · ${fieldLabels[field] ?? field}` : ''}`;
};

/** Configura o snapshot inicial do tenant antes da criação do cliente. */
export function ClientInitialSettingsFields({ value, onChange, storageDefaults, secrets, onSecretsChange }: Props) {
  const id = useId();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>('general');
  const [policyPath, setPolicyPath] = useState('general');
  const [notice, setNotice] = useState('');

  const update = (patch: Partial<InitialEnvironmentSettings>) => onChange({ ...value, ...patch });
  const updateSecret = (key: keyof InitialEnvironmentSecrets, next: string) => {
    const copy = { ...secrets };
    if (next) copy[key] = next;
    else delete copy[key];
    onSecretsChange(copy);
  };
  const activeLabel = tabs.find(([key]) => key === activeTab)?.[1] ?? 'Configurações';

  function addPolicy() {
    update({ policies: { ...value.policies, [policyPath]: value.policies[policyPath] ?? { visible: true, editable: true } } });
    setNotice(`Regra de ${policyLabel(policyPath)} adicionada. Configure visibilidade e edição abaixo.`);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-5">
      <div>
        <h2 id={`${id}-title`} className="text-base font-semibold text-slate-900">Parâmetros iniciais</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Estes valores serão aplicados uma única vez aos ambientes criados para o cliente. Segredos são enviados à parte e não voltam na consulta de parâmetros.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <div role="tablist" aria-label="Grupos de parâmetros iniciais" className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" id={`${id}-tab-${key}`} aria-selected={activeTab === key}
              aria-controls={`${id}-panel-${key}`} onClick={() => setActiveTab(key)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700 ${activeTab === key ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tabs.map(([key, label]) => key === activeTab && (
        <div key={key} role="tabpanel" id={`${id}-panel-${key}`} aria-labelledby={`${id}-tab-${key}`} className="space-y-5">
          <h3 className="text-sm font-semibold text-slate-900">{label}</h3>

          {key === 'general' && <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-3">
              <p className="text-sm text-slate-600">O calendário padrão será copiado para cada ambiente criado. Depois, os horários de cada ambiente podem ser alterados separadamente.</p>
              <BusinessHoursEditor value={businessHoursFromSettings(value)} onChange={businessHours => update({ businessHours })} />
            </div>
            <Field label="Descrição do sistema"><TextInput value={value.systemDescription ?? ''} onChange={systemDescription => update({ systemDescription: systemDescription || null })} /></Field>
            <p className="sm:col-span-2 text-xs leading-5 text-slate-500">Logo, cor principal e imagem de destaque são definidos na identificação do cliente. A descrição do sistema pode ser ajustada aqui.</p>
          </div>}

          {key === 'email' && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Servidor SMTP"><TextInput value={value.smtpHost ?? ''} placeholder="smtp.exemplo.gov.br" onChange={smtpHost => update({ smtpHost: smtpHost || null })} /></Field>
            <Field label="Porta"><NumberInput value={value.smtpPort} min={1} max={65535} onChange={smtpPort => update({ smtpPort })} /></Field>
            <Field label="Autenticação"><SelectInput value={value.smtpAuthMode} onChange={smtpAuthMode => update({ smtpAuthMode })}><option value="none">Sem autenticação</option><option value="login">Usuário e senha</option><option value="plain">Texto simples</option></SelectInput></Field>
            <Field label="Usuário SMTP"><TextInput value={value.smtpUser ?? ''} autoComplete="off" onChange={smtpUser => update({ smtpUser: smtpUser || null })} /></Field>
            <Field label="E-mail remetente"><TextInput type="email" value={value.smtpFromAddress ?? ''} onChange={smtpFromAddress => update({ smtpFromAddress: smtpFromAddress || null })} /></Field>
            <Field label="Nome remetente"><TextInput value={value.smtpFromName ?? ''} onChange={smtpFromName => update({ smtpFromName: smtpFromName || null })} /></Field>
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={value.smtpUseSsl} onChange={e => update({ smtpUseSsl: e.target.checked })} />Usar TLS/SSL</label>
            <SecretField label="Senha SMTP" value={secrets.smtpPassword ?? ''} onChange={v => updateSecret('smtpPassword', v)} />
            <p className="sm:col-span-2 text-xs leading-5 text-slate-500">A senha fica somente nesta submissão segura e não será mostrada novamente. Deixe em branco para configurar depois.</p>
          </div>}

          {key === 'storage' && <div className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-800">Onde guardar os arquivos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <StorageChoice checked={value.storageMode === 'shared'} title="Armazenamento compartilhado" description="Usa o bucket central da plataforma com isolamento por cliente e ambiente." onClick={() => { update({ storageMode: 'shared' }); updateSecret('s3SecretKey', ''); }} />
                <StorageChoice checked={value.storageMode === 'dedicated'} title="Armazenamento dedicado" description="Usa um bucket e endpoint próprios para este cliente." onClick={() => update({ storageMode: 'dedicated' })} />
              </div>
            </fieldset>
            {value.storageMode === 'shared' ? <div className={`rounded-md border p-3 text-sm ${storageDefaults.sharedConfigured ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
              <p className="font-medium">{storageDefaults.sharedConfigured ? 'Padrão da plataforma' : 'Armazenamento compartilhado não configurado'}</p>
              {storageDefaults.sharedConfigured ? <p className="mt-1 text-xs leading-5">{storageDefaults.bucketName || 'Bucket central'}{storageDefaults.region ? ` · ${storageDefaults.region}` : ''}{storageDefaults.endpoint ? ` · ${storageDefaults.endpoint}` : ''}. O backend aplicará esses valores sem gravá-los no snapshot do cliente.</p> : <p className="mt-1 text-xs leading-5">Configure o armazenamento da plataforma antes de provisionar ambientes que precisem receber arquivos.</p>}
            </div> : <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bucket dedicado"><TextInput value={value.s3BucketName ?? ''} onChange={s3BucketName => update({ s3BucketName: s3BucketName || null })} /></Field>
              <Field label="Região"><TextInput value={value.s3Region ?? ''} placeholder="us-east-1" onChange={s3Region => update({ s3Region: s3Region || null })} /></Field>
              <Field label="Endpoint"><TextInput value={value.s3Endpoint ?? ''} placeholder="https://s3.exemplo.com" onChange={s3Endpoint => update({ s3Endpoint: s3Endpoint || null })} /></Field>
              <Field label="Chave de acesso" hint="Obrigatória para o armazenamento dedicado; fica no snapshot de configuração."><TextInput required value={value.s3AccessKey ?? ''} autoComplete="off" onChange={s3AccessKey => update({ s3AccessKey: s3AccessKey || null })} /></Field>
              <SecretField required label="Chave secreta" value={secrets.s3SecretKey ?? ''} onChange={v => updateSecret('s3SecretKey', v)} />
            </div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="URL da CDN"><TextInput value={value.s3CdnUrl ?? ''} onChange={s3CdnUrl => update({ s3CdnUrl: s3CdnUrl || null })} /></Field>
              <Field label="Validade da URL assinada (minutos)"><NumberInput value={value.s3UrlExpirationMinutes} min={1} max={10080} onChange={s3UrlExpirationMinutes => update({ s3UrlExpirationMinutes })} /></Field>
              <Field label="Classe de armazenamento"><TextInput value={value.s3StorageClass ?? ''} placeholder="STANDARD" onChange={s3StorageClass => update({ s3StorageClass: s3StorageClass || null })} /></Field>
              <Field label="Criptografia"><TextInput value={value.s3Encryption ?? ''} placeholder="AES256" onChange={s3Encryption => update({ s3Encryption: s3Encryption || null })} /></Field>
              <Field label="Extensões bloqueadas" hint="Separe extensões por vírgula."><TextInput value={value.blockedExtensions} onChange={blockedExtensions => update({ blockedExtensions })} /></Field>
              <Field label="Limite de upload (MB)"><NumberInput value={value.maxUploadMb} min={1} max={102400} onChange={maxUploadMb => update({ maxUploadMb })} /></Field>
              <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={value.s3UseSignedUrls} onChange={e => update({ s3UseSignedUrls: e.target.checked })} />Usar URLs assinadas para arquivos</label>
            </div>
          </div>}

          {key === 'security' && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Autenticação em dois fatores"><SelectInput value={value.twoFactorMode} onChange={twoFactorMode => update({ twoFactorMode: twoFactorMode as InitialEnvironmentSettings['twoFactorMode'] })}><option value="off">Desativada</option><option value="internal">Usuários internos</option><option value="all">Todos os usuários</option></SelectInput></Field>
            <Field label="Máximo de tentativas de login"><NumberInput value={value.maxLoginAttempts} min={3} max={20} onChange={maxLoginAttempts => update({ maxLoginAttempts })} /></Field>
            <Field label="Duração do bloqueio (minutos)"><NumberInput value={value.lockoutMinutes} min={1} max={1440} onChange={lockoutMinutes => update({ lockoutMinutes })} /></Field>
          </div>}

          {key === 'public' && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chave pública do Turnstile"><TextInput value={value.turnstileSiteKey ?? ''} onChange={turnstileSiteKey => update({ turnstileSiteKey: turnstileSiteKey || null })} /></Field>
            <SecretField label="Segredo do Turnstile" value={secrets.turnstileSecret ?? ''} onChange={v => updateSecret('turnstileSecret', v)} />
            <Field label="URL do portal público"><TextInput type="url" value={value.portalUrl ?? ''} placeholder="https://portal.exemplo.gov.br" onChange={portalUrl => update({ portalUrl: portalUrl || null })} /></Field>
          </div>}

          {key === 'openRouter' && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Modelo padrão"><TextInput value={value.openRouterModel ?? ''} placeholder="openai/gpt-4o-mini" onChange={openRouterModel => update({ openRouterModel: openRouterModel || null })} /></Field>
            <SecretField label="Chave da API OpenRouter" value={secrets.openRouterApiKey ?? ''} onChange={v => updateSecret('openRouterApiKey', v)} />
          </div>}

          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={`Regra de acesso · ${activeLabel}`} className="min-w-56 flex-1">
                <SelectInput value={policyPath} onChange={setPolicyPath}>
                  <option value={key}>{activeLabel} — aba inteira</option>
                  {policyFields[key].map(field => <option key={field} value={`${key}.${field}`}>{fieldLabels[field] ?? field}</option>)}
                </SelectInput>
              </Field>
              <button type="button" className={buttonClass} onClick={addPolicy}>Adicionar regra</button>
            </div>
            {notice && <p role="status" className="mt-2 text-xs text-emerald-800">{notice}</p>}
            <ul className="mt-2 divide-y divide-slate-200">
              {Object.entries(value.policies).filter(([path]) => path === key || path.startsWith(`${key}.`)).map(([path, policy]) => (
                <li key={path} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
                  <span className="min-w-40 flex-1 text-slate-700">{policyLabel(path)}</span>
                  <label className="flex min-h-9 items-center gap-2 text-slate-700"><input type="checkbox" checked={policy.visible} onChange={e => update({ policies: { ...value.policies, [path]: { ...policy, visible: e.target.checked } } })} />Visível</label>
                  <label className="flex min-h-9 items-center gap-2 text-slate-700"><input type="checkbox" checked={policy.editable} onChange={e => update({ policies: { ...value.policies, [path]: { ...policy, editable: e.target.checked } } })} />Editável</label>
                  <button type="button" className="min-h-9 text-slate-600 underline underline-offset-2" onClick={() => { const policies = { ...value.policies }; delete policies[path]; update({ policies }); }}>Remover</button>
                </li>
              ))}
            </ul>
            {!Object.keys(value.policies).some(path => path === key || path.startsWith(`${key}.`)) && <p className="mt-2 text-xs leading-5 text-slate-500">Nenhuma restrição nesta aba. Os campos ficam visíveis e editáveis pelos padrões do ambiente.</p>}
            <p className="mt-2 text-xs leading-5 text-slate-500">Uma aba oculta esconde seus campos. Desmarcar edição mantém o campo visível e somente leitura.</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function Field({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={`flex min-w-0 flex-col gap-1.5 text-sm ${className}`}>
    <span className="font-medium text-slate-700">{label}</span>
    {children}
    {hint && <span className="text-xs leading-5 text-slate-500">{hint}</span>}
  </label>;
}

function TextInput(props: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; autoComplete?: string; disabled?: boolean; required?: boolean; 'aria-label'?: string }) {
  const { value, onChange, ...attributes } = props;
  return <input {...attributes} value={value} className={inputClass} onChange={e => onChange(e.target.value)} />;
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (value: number) => void; min: number; max: number }) {
  return <input type="number" required min={min} max={max} value={value} className={inputClass} onChange={e => onChange(Number(e.target.value))} />;
}

function SelectInput({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} className={inputClass} onChange={e => onChange(e.target.value)}>{children}</select>;
}

function SecretField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <Field label={label}>
    <input type="password" value={value} required={required} autoComplete="new-password" className={inputClass} onChange={e => onChange(e.target.value)} />
  </Field>;
}

function StorageChoice({ checked, title, description, onClick }: { checked: boolean; title: string; description: string; onClick: () => void }) {
  return <label className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${checked ? 'border-slate-500 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}>
    <input type="radio" name="initial-storage-mode" checked={checked} onChange={onClick} className="mt-1" />
    <span><span className="block font-medium text-slate-800">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></span>
  </label>;
}
