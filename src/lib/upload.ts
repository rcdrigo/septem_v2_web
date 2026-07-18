import { api } from '@/lib/api';

/** De onde o upload tira o processo/execução (o servidor resolve o resto). */
export type UploadContext = { taskId?: string; processKey?: string; number?: string };

/** Um anexo já enviado ao storage. É isto que fica salvo no valor do campo. */
export type Attachment = { name: string; url: string; size: number };

/**
 * Sobe UM arquivo do campo de anexo para o storage do tenant. O servidor aplica a
 * política (extensões perigosas + tamanho) e as extensões permitidas do campo, e
 * devolve a URL. Lança ApiError (o chamador mostra o detail).
 */
export async function uploadAttachment(ctx: UploadContext, fieldKey: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file);
  form.append('fieldKey', fieldKey);
  if (ctx.taskId) form.append('taskId', ctx.taskId);
  if (ctx.processKey) form.append('processKey', ctx.processKey);
  if (ctx.number) form.append('number', ctx.number);
  return api.postForm<Attachment>('/api/v1/workflow/uploads', form);
}

/** Modelos que o campo oferece para escolha (só o modo "lista" devolve itens). */
export type DocumentOptions = { mode: string; templates: { id: string; name: string }[] };

export function fetchDocumentOptions(taskId: string, fieldKey: string): Promise<DocumentOptions> {
  return api.get<DocumentOptions>(
    `/api/v1/workflow/tasks/${taskId}/document-options?fieldKey=${encodeURIComponent(fieldKey)}`);
}

/**
 * Gera o documento do campo (Fase 6g). O servidor resolve o modelo pela
 * parametrização, preenche com os dados da solicitação e devolve o anexo pronto —
 * o cliente não escolhe modelo fora dos permitidos. Lança ApiError (mostre o detail).
 */
export function generateDocument(taskId: string, fieldKey: string, templateId?: string): Promise<Attachment> {
  return api.post<Attachment>(`/api/v1/workflow/tasks/${taskId}/generate-document`, { fieldKey, templateId });
}

/** Lê o valor do campo (array de anexos), tolerando string legada/JSON. */
export function parseAttachments(value: unknown): Attachment[] {
  if (Array.isArray(value)) return value as Attachment[];
  if (typeof value === 'string' && value.startsWith('[')) {
    try { return JSON.parse(value) as Attachment[]; } catch { return []; }
  }
  return [];
}
