import { useEffect, useState } from 'react';
import { Checkbox, Field, RadioGroup, Select, Section, TextArea, TextInput } from '@/components/ui/Field';
import {
  PROCESS_CONFIG_DEFAULTS,
  getProcessConfig,
  setProcessConfig,
  type ProcessConfig,
  type ProcessStatus,
} from '@/lib/bpmn-process';
import { useModeladorStore } from '@/stores/modelador';

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
  const [draftName, setDraftName] = useState(processName);

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
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-6 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Configurações do processo</h2>
          <p className="text-xs text-slate-500">
            Metadados publicados quando o processo é disponibilizado aos usuários.
          </p>
        </header>

        <Section title="Identificação">
          <Field label="Nome" hint="Mesmo nome exibido na barra superior.">
            <TextInput
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              placeholder="Nome do processo"
            />
          </Field>
          <Field label="Descrição">
            <TextArea
              value={cfg.description}
              onChange={(e) => setCfg((c) => ({ ...c, description: e.target.value }))}
              onBlur={() => patch({ description: cfg.description })}
              rows={3}
              placeholder="Resumo objetivo do processo (1-3 linhas)"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select
                value={cfg.categoryId}
                onChange={(e) => patch({ categoryId: e.target.value })}
                options={CATEGORY_OPTIONS}
              />
            </Field>
            <Field label="Área responsável" hint="ID da unidade organizacional.">
              <TextInput
                value={cfg.areaId}
                onChange={(e) => setCfg((c) => ({ ...c, areaId: e.target.value }))}
                onBlur={() => patch({ areaId: cfg.areaId })}
                placeholder="ex: protocolo-sp"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ícone" hint="Identificador da iconografia (ex: file-text).">
              <TextInput
                value={cfg.icon}
                onChange={(e) => setCfg((c) => ({ ...c, icon: e.target.value }))}
                onBlur={() => patch({ icon: cfg.icon })}
                placeholder="ex: file-text"
              />
            </Field>
            <Field label="URL da documentação">
              <TextInput
                type="url"
                value={cfg.documentationUrl}
                onChange={(e) => setCfg((c) => ({ ...c, documentationUrl: e.target.value }))}
                onBlur={() => patch({ documentationUrl: cfg.documentationUrl })}
                placeholder="https://…"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Inbox / resumo da requisição"
          description="HTML curto mostrado nas listagens de processo. Variáveis podem ser inseridas com {{campo}}."
        >
          <Field label="Conteúdo">
            <TextArea
              value={cfg.inbox}
              onChange={(e) => setCfg((c) => ({ ...c, inbox: e.target.value }))}
              onBlur={() => patch({ inbox: cfg.inbox })}
              rows={5}
              placeholder="<strong>{{titulo}}</strong> — solicitado por {{requisitante}}"
            />
          </Field>
        </Section>

        <Section title="Publicação">
          <Field label="Status">
            <RadioGroup<ProcessStatus>
              name="proc-status"
              value={cfg.status}
              onChange={(v) => patch({ status: v })}
              options={STATUS_OPTIONS as any}
            />
          </Field>
        </Section>

        <Section title="Comportamentos durante a execução">
          <Checkbox
            checked={cfg.allowMessages}
            onChange={(v) => patch({ allowMessages: v })}
            label="Permitir inserção de mensagens nas execuções"
          />
          <Checkbox
            checked={cfg.allowCancel}
            onChange={(v) => patch({ allowCancel: v })}
            label="Permitir cancelamento do processo"
          />
          <Checkbox
            checked={cfg.allowAnonymous}
            onChange={(v) => patch({ allowAnonymous: v })}
            label="Permitir requisições anônimas (portal)"
            hint="Requer formulário aceitando dados sem autenticação."
          />
        </Section>
      </div>
    </div>
  );
}
