import { useEffect, useState } from 'react';
import { Save, Building2, Mail, HardDrive, Loader2, Send, PlugZap, ShieldCheck } from 'lucide-react';
import { toast } from '@/stores/toast';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { ApiError } from '@/lib/api';
import {
  useSettings,
  useSaveGeneral,
  useSaveEmail,
  useTestEmail,
  useSaveStorage,
  useTestStorage,
  useSaveSecurity,
  parseDays,
  WEEKDAYS,
  type GeneralPayload,
  type EmailPayload,
  type SettingsEmail,
  type StoragePayload,
  type SettingsStorage,
  type SettingsSecurity,
} from '@/lib/api/settings';

type TabKey = 'geral' | 'email' | 'arquivos' | 'seguranca';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Building2 }> = [
  { key: 'geral', label: 'Informações gerais', icon: Building2 },
  { key: 'email', label: 'E-mail', icon: Mail },
  { key: 'arquivos', label: 'Arquivos', icon: HardDrive },
  { key: 'seguranca', label: 'Segurança', icon: ShieldCheck },
];

/**
 * Configurações › Parâmetros do sistema (Fase 1).
 * Três abas: identidade visual + expediente, servidor de e-mail e armazenamento.
 * Segredos são write-only: o backend só informa se estão configurados.
 */
export function ParametrosPage() {
  useDocumentTitle('Parâmetros do sistema');
  const [tab, setTab] = useState<TabKey>('geral');
  const { data, isLoading } = useSettings();

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-slate-900">Parâmetros do sistema</h1>
        <p className="mt-0.5 text-sm text-slate-500">Identidade, expediente, e-mail e armazenamento de arquivos.</p>
        <nav className="-mb-4 mt-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Seções de parâmetros">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={15} className="hidden sm:block" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Carregando parâmetros...
          </p>
        )}
        {data && tab === 'geral' && <GeralTab data={data.general} />}
        {data && tab === 'email' && <EmailTab data={data.email} />}
        {data && tab === 'arquivos' && <ArquivosTab data={data.storage} />}
        {data && tab === 'seguranca' && <SegurancaTab data={data.security} />}
      </div>
    </div>
  );
}

function EmailTab({ data }: { data: SettingsEmail }) {
  const save = useSaveEmail();
  const test = useTestEmail();

  const [form, setForm] = useState<EmailPayload>(() => ({ ...data, password: null }));
  // Senha é write-only: o backend só diz se existe. Só mandamos algo quando o
  // admin digita (ou quando ele pede explicitamente para limpar).
  const [novaSenha, setNovaSenha] = useState('');
  // O teste vai, por padrão, para o e-mail de quem está configurando.
  const meuEmail = useSessionStore((s) => s.user?.email ?? '');
  const [destino, setDestino] = useState(meuEmail);

  useEffect(() => {
    setForm({ ...data, password: null });
    setNovaSenha('');
  }, [data]);

  const set = <K extends keyof EmailPayload>(k: K, v: EmailPayload[K]) => setForm((f) => ({ ...f, [k]: v }));
  const precisaSenha = form.authMode !== 'none';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ ...form, password: novaSenha.length > 0 ? novaSenha : null });
      setNovaSenha('');
      toast.success('Configuração de e-mail salva.');
    } catch (err) {
      toast.error(detalhe(err) ?? 'Não foi possível salvar a configuração de e-mail.');
    }
  }

  async function onTest() {
    if (!destino.includes('@')) {
      toast.error('Informe um e-mail de destino válido.');
      return;
    }
    try {
      await test.mutateAsync(destino);
      toast.success(`E-mail de teste enviado para ${destino}.`);
    } catch (err) {
      toast.error(detalhe(err) ?? 'Falha ao enviar o e-mail de teste.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5" data-testid="form-email">
      <Card title="Servidor SMTP" hint="Usado por todos os e-mails do sistema (avisos de tarefa, prazos e eventos dos processos).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Servidor (host)">
            <input
              value={form.host ?? ''}
              onChange={(e) => set('host', e.target.value || null)}
              placeholder="smtp.gmail.com"
              className={inputCls}
              name="host"
            />
          </Field>
          <Field label="Porta" required>
            <input
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(e) => set('port', Number(e.target.value))}
              className={inputCls}
              name="port"
            />
          </Field>
          <Field label="Autenticação">
            <select
              value={form.authMode}
              onChange={(e) => set('authMode', e.target.value)}
              className={inputCls}
              name="authMode"
            >
              <option value="login">Login (usuário e senha)</option>
              <option value="plain">Plain</option>
              <option value="none">Sem autenticação</option>
            </select>
          </Field>
          <Field label="Conexão segura">
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.useSsl}
                onChange={(e) => set('useSsl', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
                name="useSsl"
              />
              Usar TLS/SSL
            </label>
          </Field>
          {precisaSenha && (
            <>
              <Field label="Usuário">
                <input
                  value={form.user ?? ''}
                  onChange={(e) => set('user', e.target.value || null)}
                  placeholder="no-reply@prefeitura.gov.br"
                  className={inputCls}
                  name="user"
                />
              </Field>
              <Field label={data.passwordSet ? 'Senha (configurada)' : 'Senha'}>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder={data.passwordSet ? '•••••••• (deixe em branco para manter)' : 'Senha do servidor'}
                  className={inputCls}
                  name="password"
                  autoComplete="new-password"
                />
              </Field>
            </>
          )}
          <Field label="Remetente (e-mail)">
            <input
              value={form.fromAddress ?? ''}
              onChange={(e) => set('fromAddress', e.target.value || null)}
              placeholder="nao-responda@prefeitura.gov.br"
              className={inputCls}
              name="fromAddress"
            />
          </Field>
          <Field label="Remetente (nome exibido)">
            <input
              value={form.fromName ?? ''}
              onChange={(e) => set('fromName', e.target.value || null)}
              placeholder="Prefeitura Municipal"
              className={inputCls}
              name="fromName"
            />
          </Field>
        </div>
      </Card>

      <Card title="Enviar e-mail de teste" hint="Salve a configuração antes de testar: o envio usa o que está gravado.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="destinatario@exemplo.gov.br"
            className={inputCls}
            name="testTo"
          />
          <button
            type="button"
            onClick={onTest}
            disabled={test.isPending}
            className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar teste
          </button>
        </div>
      </Card>

      <button
        type="submit"
        disabled={save.isPending}
        className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
      </button>
    </form>
  );
}

function SegurancaTab({ data }: { data: SettingsSecurity }) {
  const save = useSaveSecurity();
  const [form, setForm] = useState<SettingsSecurity>(data);

  useEffect(() => setForm(data), [data]);

  const set = <K extends keyof SettingsSecurity>(k: K, v: SettingsSecurity[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync(form);
      toast.success('Configuração de segurança salva.');
    } catch (err) {
      toast.error(detalhe(err) ?? 'Não foi possível salvar a configuração de segurança.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5" data-testid="form-seguranca">
      <Card
        title="Verificação em duas etapas"
        hint="No login, além da senha, o usuário digita um código enviado para o e-mail dele. Exige o servidor de e-mail configurado na aba E-mail."
      >
        <Field label="Quando exigir o código">
          <select
            value={form.twoFactorMode}
            onChange={(e) => set('twoFactorMode', e.target.value as SettingsSecurity['twoFactorMode'])}
            className={inputCls}
            name="twoFactorMode"
          >
            <option value="off">Nunca (desligado)</option>
            <option value="internal">Somente funcionários (usuários internos)</option>
            <option value="all">Todos os usuários</option>
          </select>
        </Field>
        <p className="mt-2 text-xs text-slate-500">
          Quem marcar "confiar neste dispositivo" não é desafiado de novo naquele aparelho — e pode
          removê-lo a qualquer momento em Meus dados.
        </p>
      </Card>

      <Card title="Bloqueio por tentativas" hint="Protege contra tentativa de adivinhar a senha. A tela avisa quantas tentativas restam.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tentativas até bloquear" required>
            <input
              type="number"
              min={3}
              max={20}
              value={form.maxLoginAttempts}
              onChange={(e) => set('maxLoginAttempts', Number(e.target.value))}
              className={inputCls}
              name="maxLoginAttempts"
            />
          </Field>
          <Field label="Minutos de bloqueio" required>
            <input
              type="number"
              min={1}
              max={1440}
              value={form.lockoutMinutes}
              onChange={(e) => set('lockoutMinutes', Number(e.target.value))}
              className={inputCls}
              name="lockoutMinutes"
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Redefinir a senha ("Esqueci minha senha") libera a conta na hora, sem esperar o bloqueio expirar.
        </p>
      </Card>

      <button
        type="submit"
        disabled={save.isPending}
        className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
      </button>
    </form>
  );
}

function ArquivosTab({ data }: { data: SettingsStorage }) {
  const save = useSaveStorage();
  const test = useTestStorage();

  const [form, setForm] = useState<StoragePayload>(() => ({ ...data, secretKey: null }));
  const [novaSecret, setNovaSecret] = useState('');

  useEffect(() => {
    setForm({ ...data, secretKey: null });
    setNovaSecret('');
  }, [data]);

  const set = <K extends keyof StoragePayload>(k: K, v: StoragePayload[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ ...form, secretKey: novaSecret.length > 0 ? novaSecret : null });
      setNovaSecret('');
      toast.success('Configuração de arquivos salva.');
    } catch (err) {
      toast.error(detalhe(err) ?? 'Não foi possível salvar a configuração de arquivos.');
    }
  }

  async function onTest() {
    try {
      await test.mutateAsync();
      toast.success('Conexão com o bucket ok.');
    } catch (err) {
      toast.error(detalhe(err) ?? 'Falha ao conectar no bucket.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5" data-testid="form-arquivos">
      <Card title="Bucket" hint="Onde os anexos dos formulários e os documentos gerados são guardados (S3 ou compatível, como MinIO).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bucket">
            <input value={form.bucketName ?? ''} onChange={(e) => set('bucketName', e.target.value || null)} placeholder="septem-anexos" className={inputCls} name="bucketName" />
          </Field>
          <Field label="Região">
            <input value={form.region ?? ''} onChange={(e) => set('region', e.target.value || null)} placeholder="us-east-1" className={inputCls} name="region" />
          </Field>
          <Field label="Endpoint">
            <input value={form.endpoint ?? ''} onChange={(e) => set('endpoint', e.target.value || null)} placeholder="http://localhost:9000 (MinIO)" className={inputCls} name="endpoint" />
          </Field>
          <Field label="Pasta base">
            <input value={form.baseFolder ?? ''} onChange={(e) => set('baseFolder', e.target.value || null)} placeholder="prefeitura-x" className={inputCls} name="baseFolder" />
          </Field>
          <Field label="Access key">
            <input value={form.accessKey ?? ''} onChange={(e) => set('accessKey', e.target.value || null)} className={inputCls} name="accessKey" />
          </Field>
          <Field label={data.secretKeySet ? 'Secret key (configurada)' : 'Secret key'}>
            <input
              type="password"
              value={novaSecret}
              onChange={(e) => setNovaSecret(e.target.value)}
              placeholder={data.secretKeySet ? '•••••••• (deixe em branco para manter)' : 'Secret key'}
              className={inputCls}
              name="secretKey"
              autoComplete="new-password"
            />
          </Field>
        </div>
      </Card>

      <Card title="Entrega dos arquivos" hint="URLs assinadas expiram e impedem acesso direto ao anexo; sem elas, o arquivo é servido pela URL pública/CDN.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="URL do CDN">
            <input value={form.cdnUrl ?? ''} onChange={(e) => set('cdnUrl', e.target.value || null)} placeholder="https://cdn.prefeitura.gov.br" className={inputCls} name="cdnUrl" />
          </Field>
          <Field label="URLs assinadas">
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.useSignedUrls} onChange={(e) => set('useSignedUrls', e.target.checked)} className="h-4 w-4 rounded border-slate-300" name="useSignedUrls" />
              Gerar URLs assinadas
            </label>
          </Field>
          {form.useSignedUrls && (
            <Field label="Validade da URL (minutos)" required>
              <input type="number" min={1} max={10080} value={form.urlExpirationMinutes} onChange={(e) => set('urlExpirationMinutes', Number(e.target.value))} className={inputCls} name="urlExpirationMinutes" />
            </Field>
          )}
          <Field label="Classe de armazenamento">
            <select value={form.storageClass ?? 'STANDARD'} onChange={(e) => set('storageClass', e.target.value)} className={inputCls} name="storageClass">
              <option value="STANDARD">Standard</option>
              <option value="STANDARD_IA">Standard — acesso infrequente</option>
              <option value="GLACIER">Glacier (arquivamento)</option>
            </select>
          </Field>
          <Field label="Criptografia">
            <select value={form.encryption ?? ''} onChange={(e) => set('encryption', e.target.value || null)} className={inputCls} name="encryption">
              <option value="">Nenhuma</option>
              <option value="AES256">AES-256 (no servidor)</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Limites de upload" hint="Valem para todo anexo enviado nos formulários.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tamanho máximo (MB)" required>
            <input type="number" min={1} max={1024} value={form.maxUploadMb} onChange={(e) => set('maxUploadMb', Number(e.target.value))} className={inputCls} name="maxUploadMb" />
          </Field>
          <Field label="Extensões bloqueadas">
            <input value={form.blockedExtensions} onChange={(e) => set('blockedExtensions', e.target.value)} placeholder="exe,bat,cmd" className={inputCls} name="blockedExtensions" />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={save.isPending} className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60">
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
        </button>
        <button type="button" onClick={onTest} disabled={test.isPending} className="flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60">
          {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />} Testar conexão
        </button>
      </div>
    </form>
  );
}

/** Mensagem que o backend mandou no `detail` — é o que explica o erro do SMTP. */
function detalhe(err: unknown): string | undefined {
  return err instanceof ApiError ? (err.body as { detail?: string } | undefined)?.detail : undefined;
}

function GeralTab({ data }: { data: GeneralPayload & { tenantId: string; host: string | null } }) {
  const save = useSaveGeneral();
  const refreshTenant = useSessionStore((s) => s.refreshTenant);

  const [form, setForm] = useState<GeneralPayload>(() => pick(data));
  const [days, setDays] = useState<number[]>(() => parseDays(data.businessDays));

  // Se outra aba/salvamento atualizar o cache, refletir aqui.
  useEffect(() => {
    setForm(pick(data));
    setDays(parseDays(data.businessDays));
  }, [data]);

  const set = <K extends keyof GeneralPayload>(k: K, v: GeneralPayload[K]) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (days.length === 0) {
      toast.error('Selecione ao menos um dia útil.');
      return;
    }
    if (form.businessHourEnd <= form.businessHourStart) {
      toast.error('O fim do expediente deve ser depois do início.');
      return;
    }
    try {
      await save.mutateAsync({ ...form, businessDays: days.join(',') });
      await refreshTenant(); // logo/nome/cor mudam no topo sem precisar recarregar
      toast.success('Parâmetros salvos.');
    } catch (err) {
      toast.error(detalhe(err) ?? 'Não foi possível salvar os parâmetros.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5" data-testid="form-geral">
      <Card title="Identidade" hint="Aparece no cabeçalho, na tela de login e nos e-mails enviados pelo sistema.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do cliente" required>
            <input
              value={form.clienteNome}
              onChange={(e) => set('clienteNome', e.target.value)}
              required
              maxLength={120}
              className={inputCls}
              name="clienteNome"
            />
          </Field>
          <Field label="Nome do ambiente" required>
            <input
              value={form.ambienteNome}
              onChange={(e) => set('ambienteNome', e.target.value)}
              required
              maxLength={120}
              className={inputCls}
              name="ambienteNome"
            />
          </Field>
          <Field label="URL do logo">
            <input
              value={form.logoUrl ?? ''}
              onChange={(e) => set('logoUrl', e.target.value || null)}
              placeholder="https://..."
              className={inputCls}
              name="logoUrl"
            />
          </Field>
          <Field label="Cor primária">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : '#0f172a'}
                onChange={(e) => set('primaryColor', e.target.value)}
                aria-label="Selecionar cor primária"
                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-1"
              />
              <input
                value={form.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                placeholder="#0f172a"
                className={inputCls}
                name="primaryColor"
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Tela de login" hint="Imagem de fundo e texto de apresentação exibidos ao entrar.">
        <div className="space-y-4">
          <Field label="URL da imagem de destaque">
            <input
              value={form.heroImageUrl ?? ''}
              onChange={(e) => set('heroImageUrl', e.target.value || null)}
              placeholder="https://..."
              className={inputCls}
              name="heroImageUrl"
            />
          </Field>
          <Field label="Descrição do sistema">
            <textarea
              value={form.systemDescription ?? ''}
              onChange={(e) => set('systemDescription', e.target.value || null)}
              rows={3}
              maxLength={400}
              placeholder="Portal de serviços e processos do município."
              className={inputCls}
              name="systemDescription"
            />
          </Field>
        </div>
      </Card>

      <Card title="Expediente" hint="Base para prazos das tarefas: contam apenas horas dentro do expediente, nos dias úteis.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início" required>
            <select
              value={form.businessHourStart}
              onChange={(e) => set('businessHourStart', Number(e.target.value))}
              className={inputCls}
              name="businessHourStart"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </Field>
          <Field label="Fim" required>
            <select
              value={form.businessHourEnd}
              onChange={(e) => set('businessHourEnd', Number(e.target.value))}
              className={inputCls}
              name="businessHourEnd"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Dias úteis</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.label}
                  onClick={() => toggleDay(d.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
        </button>
        <span className="text-xs text-slate-400">
          Tenant <code className="rounded bg-slate-100 px-1 py-0.5">{data.tenantId}</code>
          {data.host && <> · host {data.host}</>}
        </span>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500';

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mb-4 mt-0.5 text-xs text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function pick(d: GeneralPayload): GeneralPayload {
  return {
    clienteNome: d.clienteNome,
    ambienteNome: d.ambienteNome,
    logoUrl: d.logoUrl,
    primaryColor: d.primaryColor,
    heroImageUrl: d.heroImageUrl,
    systemDescription: d.systemDescription,
    businessHourStart: d.businessHourStart,
    businessHourEnd: d.businessHourEnd,
    businessDays: d.businessDays,
  };
}
