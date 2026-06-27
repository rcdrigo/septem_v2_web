import { useEffect, useState } from 'react';
import { Checkbox, Field, RadioGroup, Select, Section, TextArea, TextInput } from '@/components/ui/Field';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  PROCESS_CONFIG_DEFAULTS,
  getProcessConfig,
  setProcessConfig,
  type ProcessConfig,
  type ProcessStatus,
} from '@/lib/bpmn-process';
import { useModeladorStore } from '@/stores/modelador';
import { Plus, Trash2 } from 'lucide-react';
import { Combobox } from '@/components/ui/Combobox';
import { IconSearchPicker } from '@/components/ui/IconSearchPicker';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import { useAccessProfiles } from '@/lib/api/access-profiles';
import { useUsersList } from '@/lib/api/users';
import { usePositions } from '@/lib/api/positions';

type Props = {
  modeler: any | null;
};

const STATUS_OPTIONS: ReadonlyArray<{ value: ProcessStatus; label: string; hint?: string }> = [
  { value: 'draft', label: 'Rascunho', hint: 'Em construção. Não aparece para usuários finais.' },
  { value: 'published', label: 'Publicado', hint: 'Disponível para iniciar requisições.' },
  { value: 'inactive', label: 'Inativo', hint: 'Histórico preservado; novas instâncias bloqueadas.' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'protocolo', label: 'Protocolo' },
  { value: 'processos', label: 'Processos' },
  { value: 'documentos', label: 'Documentos oficiais' },
  { value: 'pareceres', label: 'Pareceres' },
  { value: 'comunicacao', label: 'Comunicação interna' },
];

/**
 * View "Configurações" — espelha os campos da tabela `flows` (nome, descrição,
 * documentation_url, icon, inbox, category_id, area_id, status, allow_*).
 *
 * Persiste em `septem:ProcessConfig` no elemento `bpmn:Process` (XML é a verdade).
 * O campo "Nome" é o mesmo do navbar (Zustand espelha `bpmn:Process.name`).
 *
 * Categorias e áreas são fixas por ora; quando o backend chegar (Fase 6) serão
 * combos populadas via `/api/categories` e `/api/areas`.
 */
export function ConfiguracoesView({ modeler }: Props) {
  const processName = useModeladorStore((s) => s.processName);
  const setProcessName = useModeladorStore((s) => s.setProcessName);

  const [cfg, setCfg] = useState<ProcessConfig>(PROCESS_CONFIG_DEFAULTS);
  const orgUnits = useOrgUnitsFlat();
  const [draftName, setDraftName] = useState(processName);
  const [tab, setTab] = useState<'geral' | 'acesso'>('geral');

  useEffect(() => {
    if (!modeler) return;
    setCfg(getProcessConfig(modeler));
  }, [modeler]);

  useEffect(() => setDraftName(processName), [processName]);

  if (!modeler) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Aguarde o modelador carregar.</p>
      </div>
    );
  }

  function patch(p: Partial<ProcessConfig>) {
    const next = { ...cfg, ...p };
    setCfg(next);
    setProcessConfig(modeler!, p);
  }

  function commitName() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === processName) return;
    setProcessName(trimmed);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-full flex-1 flex-col overflow-y-auto bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-6 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Configurações do processo</h2>
          <p className="text-xs text-slate-500">
            Metadados publicados quando o processo é disponibilizado aos usuários.
          </p>
        </header>

        {/* Abas */}
        <div className="flex gap-1 border-b border-slate-200 px-6 pt-2">
          {([['geral', 'Informações gerais'], ['acesso', 'Controle de acesso']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'geral' && (
          <>
            <Section title="Identificação">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
                {/* Coluna 1 */}
                <div className="flex flex-col gap-3">
                  <Field label="Nome" hint="Mesmo nome exibido na barra superior.">
                    <TextInput value={draftName} onChange={(e) => setDraftName(e.target.value)} onBlur={commitName} placeholder="Nome do processo" />
                  </Field>
                  <Field label="Categoria">
                    <Select value={cfg.categoryId} onChange={(e) => patch({ categoryId: e.target.value })} options={CATEGORY_OPTIONS} />
                  </Field>
                  <Field label="Área responsável" hint="Unidade organizacional.">
                    <Combobox
                      value={cfg.areaId}
                      options={(orgUnits.data ?? []).map((u) => ({ value: u.key, label: u.name }))}
                      onChange={(v) => { setCfg((c) => ({ ...c, areaId: v })); patch({ areaId: v }); }}
                      clearLabel="— nenhuma —"
                      placeholder="Selecione a unidade"
                    />
                  </Field>
                  <Field label="URL da documentação">
                    <TextInput type="url" value={cfg.documentationUrl}
                      onChange={(e) => setCfg((c) => ({ ...c, documentationUrl: e.target.value }))}
                      onBlur={() => patch({ documentationUrl: cfg.documentationUrl })} placeholder="https://…" />
                  </Field>
                  <Field label="Ícone" hint="Ícone do processo (FontAwesome).">
                    <IconSearchPicker value={cfg.icon} onChange={(cls) => { setCfg((c) => ({ ...c, icon: cls ?? '' })); patch({ icon: cls ?? '' }); }} />
                  </Field>
                </div>
                {/* Coluna 2 */}
                <div className="flex flex-col gap-3">
                  <Field label="Descrição" hint="Aceita formatação (negrito, listas, links) e quebras de linha — exibido nas listagens de serviço.">
                    <RichTextEditor
                      value={cfg.description ?? ''}
                      onChange={(html) => setCfg((c) => ({ ...c, description: html }))}
                      onBlur={() => patch({ description: cfg.description })}
                    />
                  </Field>
                  <Field label="Inbox / resumo da requisição" hint="HTML curto mostrado nas listagens. Variáveis com {{campo}}.">
                    <TextArea
                      value={cfg.inbox}
                      onChange={(e) => setCfg((c) => ({ ...c, inbox: e.target.value }))}
                      onBlur={() => patch({ inbox: cfg.inbox })}
                      rows={5}
                      placeholder="<strong>{{titulo}}</strong> — solicitado por {{requisitante}}"
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Publicação e permissões">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
                {/* Coluna 1 */}
                <div className="flex flex-col gap-3">
                  <Field label="Status">
                    <RadioGroup<ProcessStatus> name="proc-status" value={cfg.status} onChange={(v) => patch({ status: v })} options={STATUS_OPTIONS as any} />
                  </Field>
                </div>
                {/* Coluna 2 */}
                <div className="flex flex-col gap-2">
                  <Field label="Permissões durante a execução">
                    <div className="flex flex-col gap-2">
                      <Checkbox checked={cfg.allowMessages} onChange={(v) => patch({ allowMessages: v })} label="Permitir inserção de mensagens nas execuções" />
                      <Checkbox checked={cfg.allowCancel} onChange={(v) => patch({ allowCancel: v })} label="Permitir cancelamento do processo" />
                      <Checkbox checked={cfg.allowAnonymous} onChange={(v) => patch({ allowAnonymous: v })} label="Permitir requisições anônimas (portal)" hint="Requer formulário aceitando dados sem autenticação." />
                    </div>
                  </Field>
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'acesso' && (
          <AccessControlSection value={cfg.accessRules} onChange={(json) => patch({ accessRules: json })} />
        )}
      </div>
    </div>
  );
}

type AccessRule = {
  type: 'user' | 'profile' | 'orgUnit' | 'position' | 'orgUnitPosition';
  action: 'allow' | 'deny';
  userId?: string;
  profileId?: string;
  orgUnitId?: string;
  positionId?: string;
};

const RULE_TYPES = [
  { value: 'user', label: 'Usuário específico' },
  { value: 'profile', label: 'Perfil de acesso' },
  { value: 'orgUnit', label: 'Unidade organizacional' },
  { value: 'position', label: 'Posição' },
  { value: 'orgUnitPosition', label: 'Unidade + posição' },
] as const;

/** Controle de acesso ao processo: regras permitir/bloquear (padrão liberado). */
function AccessControlSection({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  let rules: AccessRule[] = [];
  try { const p = JSON.parse(value || '[]'); if (Array.isArray(p)) rules = p; } catch { /* ignora */ }

  function commit(next: AccessRule[]) { onChange(JSON.stringify(next)); }
  function update(i: number, patch: Partial<AccessRule>) { commit(rules.map((r, j) => (j === i ? { ...r, ...patch } : r))); }
  function remove(i: number) { commit(rules.filter((_, j) => j !== i)); }
  function add() { commit([...rules, { type: 'user', action: 'allow' }]); }

  return (
    <Section
      title="Controle de acesso"
      description="Mesmo publicado, restrinja quem vê/inicia o processo. Sem regras = liberado a todos. Regras 'Bloquear' restringem; 'Permitir' é exceção (libera mesmo se bloqueado). Administradores sempre acessam."
    >
      {rules.length === 0 && <p className="text-xs text-slate-500">Nenhuma regra — processo liberado para todos.</p>}
      <div className="flex flex-col gap-2">
        {rules.map((rule, i) => <AccessRuleRow key={i} rule={rule} onChange={(p) => update(i, p)} onRemove={() => remove(i)} />)}
      </div>
      <button type="button" onClick={add} className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
        <Plus size={13} /> Adicionar regra
      </button>
    </Section>
  );
}

function AccessRuleRow({ rule, onChange, onRemove }: { rule: AccessRule; onChange: (p: Partial<AccessRule>) => void; onRemove: () => void }) {
  const users = useUsersList({ page: 1, pageSize: 200 });
  const profiles = useAccessProfiles();
  const orgUnits = useOrgUnitsFlat();
  const needsPosition = rule.type === 'position' || rule.type === 'orgUnitPosition';
  const positions = usePositions(needsPosition ? (rule.orgUnitId ?? null) : null);

  return (
    <div className="grid grid-cols-[1.3fr_1.6fr_1fr_auto] items-end gap-2 rounded-md border border-slate-200 bg-white p-2 [&>*]:min-w-0">
      <Field label="Aplicar a">
        <Select value={rule.type} options={RULE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          onChange={(e) => onChange({ type: e.target.value as AccessRule['type'], userId: undefined, profileId: undefined, orgUnitId: undefined, positionId: undefined })} />
      </Field>
      <Field label="Valor">
        {rule.type === 'user' && <Combobox value={rule.userId ?? ''} options={(users.data?.items ?? []).map((u) => ({ value: u.id, label: u.name }))} onChange={(v) => onChange({ userId: v })} placeholder="Selecionar usuário…" />}
        {rule.type === 'profile' && <Combobox value={rule.profileId ?? ''} options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => onChange({ profileId: v })} placeholder="Selecionar perfil…" />}
        {rule.type === 'orgUnit' && <Combobox value={rule.orgUnitId ?? ''} options={(orgUnits.data ?? []).map((o) => ({ value: o.id, label: o.name }))} onChange={(v) => onChange({ orgUnitId: v })} placeholder="Selecionar unidade…" />}
        {needsPosition && (
          <div className="flex flex-col gap-1.5">
            <Combobox value={rule.orgUnitId ?? ''} options={(orgUnits.data ?? []).map((o) => ({ value: o.id, label: o.name }))} onChange={(v) => onChange({ orgUnitId: v, positionId: undefined })} placeholder="Unidade…" />
            <Combobox value={rule.positionId ?? ''} options={(positions.data ?? []).map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => onChange({ positionId: v })} placeholder={rule.orgUnitId ? 'Posição…' : 'Escolha a unidade primeiro'} disabled={!rule.orgUnitId} />
          </div>
        )}
      </Field>
      <Field label="Ação">
        <Select value={rule.action} options={[{ value: 'allow', label: 'Permitir' }, { value: 'deny', label: 'Bloquear' }]} onChange={(e) => onChange({ action: e.target.value as AccessRule['action'] })} />
      </Field>
      <button type="button" onClick={onRemove} aria-label="Remover regra" className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
    </div>
  );
}
