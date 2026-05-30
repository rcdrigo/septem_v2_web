import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import {
  usePositions,
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
  type Position,
} from '@/lib/api/positions';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { slugify } from '@/lib/slugify';

/**
 * Admin › Configurações › Posições — IF1.c. Escolhe uma unidade e lista/gerencia
 * suas posições (`GET /api/v1/positions?orgUnitId=`). A chave da posição é o que o
 * modelador referencia como posição do responsável.
 */
export function PosicoesPage() {
  const units = useOrgUnitsFlat();
  const [orgUnitId, setOrgUnitId] = useState<string>('');
  const positions = usePositions(orgUnitId || null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const del = useDeletePosition();

  const unitOptions = (units.data ?? []).map((u) => ({ value: u.id, label: u.name }));

  async function askDelete(pos: Position) {
    const ok = await confirm({
      title: 'Excluir posição?',
      message: `"${pos.name}" será removida desta unidade.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(pos.id);
      toast.success(`Posição "${pos.name}" excluída.`);
    } catch {
      toast.error('Falha ao excluir a posição.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Posições</h1>
        <button
          type="button"
          disabled={!orgUnitId}
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          <Plus size={16} /> Nova posição
        </button>
      </header>

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-sm text-slate-500">Unidade:</span>
        <div className="w-72">
          <Select
            value={orgUnitId}
            options={unitOptions}
            placeholder={units.isLoading ? 'Carregando…' : 'Selecione uma unidade'}
            disabled={units.isLoading}
            onChange={(e) => setOrgUnitId(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!orgUnitId && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">Selecione uma unidade</p>
            <p className="mt-1 text-sm text-slate-500">As posições são cadastradas dentro de uma unidade organizacional.</p>
          </div>
        )}

        {orgUnitId && (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Posição</th>
                <th className="px-4 py-2 text-left">Chave</th>
                <th className="px-4 py-2 w-20" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {positions.isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {!positions.isLoading && (positions.data?.length ?? 0) === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Nenhuma posição nesta unidade.</td></tr>
              )}
              {positions.data?.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{p.key}</code></td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditPos(p)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => askDelete(p)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && <CreatePositionDialog orgUnitId={orgUnitId} onClose={() => setCreateOpen(false)} />}
      {editPos && <EditPositionDialog pos={editPos} onClose={() => setEditPos(null)} />}
    </div>
  );
}

function CreatePositionDialog({ orgUnitId, onClose }: { orgUnitId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const create = useCreatePosition();

  function onName(v: string) {
    setName(v);
    if (!keyTouched) setKey(slugify(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ key, name, orgUnitId });
      toast.success(`Posição "${name}" criada.`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.error('Já existe uma posição com essa chave nesta unidade.');
      else toast.error('Não foi possível criar a posição.');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Nova posição" footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="create-pos-form" type="submit" disabled={create.isPending || !name || !key}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Criar</button>
      </>
    }>
      <form id="create-pos-form" className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Nome">
          <TextInput required autoFocus value={name} onChange={(e) => onName(e.target.value)} />
        </Field>
        <Field label="Chave" hint="Slug estável referenciado pelo modelador.">
          <TextInput required value={key} onChange={(e) => { setKeyTouched(true); setKey(slugify(e.target.value)); }} />
        </Field>
      </form>
    </Dialog>
  );
}

function EditPositionDialog({ pos, onClose }: { pos: Position; onClose: () => void }) {
  const [name, setName] = useState(pos.name);
  const update = useUpdatePosition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: pos.id, body: { key: pos.key, name, orgUnitId: pos.orgUnitId } });
      toast.success('Alterações salvas.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Editar posição" footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="edit-pos-form" type="submit" disabled={update.isPending}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Salvar</button>
      </>
    }>
      <form id="edit-pos-form" className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Nome">
          <TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Chave">
          <TextInput value={pos.key} readOnly className="bg-slate-50 text-slate-500" />
        </Field>
      </form>
    </Dialog>
  );
}
