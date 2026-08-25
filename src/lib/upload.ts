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

// ── Assinatura eletrônica simples (Fase 7a) ─────────────────────────────────

/** Situação da assinatura em relação ao arquivo que está no storage AGORA. */
export type SignatureState = 'valid' | 'file_changed' | 'file_missing';

export type DocSignature = {
  id: string;
  signerName: string;
  signerCpf: string | null;
  signedAt: string;
  type: 'simple' | 'a1';
  hash: string;
  state: SignatureState;
  visualBase64: string | null;
  /** Só em assinatura por certificado (Fase 7b). */
  certSubject?: string | null;
  certIssuer?: string | null;
};

export type SignatureDoc = {
  fieldKey: string;
  fileName: string | null;
  fileUrl: string | null;
  assinaturas: DocSignature[];
};

export type TaskSignatures = {
  assinaveis: string[];
  required: boolean;
  batch: boolean;
  documentos: SignatureDoc[];
};

export function fetchTaskSignatures(taskId: string): Promise<TaskSignatures> {
  return api.get<TaskSignatures>(`/api/v1/workflow/tasks/${taskId}/signatures`);
}

/** Assina o anexo do campo. O servidor calcula o hash e identifica o signatário. */
export function signDocument(taskId: string, fieldKey: string): Promise<DocSignature> {
  return api.post<DocSignature>(
    `/api/v1/workflow/tasks/${taskId}/fields/${encodeURIComponent(fieldKey)}/sign`, {});
}

/**
 * REPRESENTAÇÃO VISUAL (documento + página de assinaturas). Não é o documento assinado
 * — a própria página diz isso em destaque, por exigência do dono.
 *
 * Vem como blob, e não como `<a href>`, porque a rota exige Bearer: um link direto para
 * `/api/v1/...` sai sem o token e responde 401.
 */
export function fetchSignaturesPreview(taskId: string, fieldKey: string): Promise<Blob> {
  return api.getBlob(
    `/api/v1/workflow/tasks/${taskId}/fields/${encodeURIComponent(fieldKey)}/signatures/preview`);
}

/**
 * URL exibível de um arquivo do storage. Caminho relativo (`/api/v1/files/...`) exige
 * autenticação, então é baixado com o cliente e vira `blob:`; URL absoluta (S3/CDN) já
 * é acessível e volta como está. Devolve também o `revoke` — sem ele cada visita
 * vaza um blob na memória da aba.
 */
export async function urlExibivel(url: string): Promise<{ href: string; revoke: () => void }> {
  if (!url.startsWith('/')) return { href: url, revoke: () => {} };
  const blob = await api.getBlob(url);
  const href = URL.createObjectURL(blob);
  return { href, revoke: () => URL.revokeObjectURL(href) };
}

/** Abre um blob numa aba nova (usado por "visualizar assinaturas"). */
export function abrirBlobEmNovaAba(blob: Blob): void {
  const href = URL.createObjectURL(blob);
  window.open(href, '_blank', 'noopener');
  // Revoga depois: revogar na hora invalidaria a URL antes de a aba carregá-la.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** Um documento está assinado quando tem ao menos uma assinatura VÁLIDA hoje. */
export function estaAssinado(doc: SignatureDoc | undefined): boolean {
  return !!doc?.assinaturas.some((a) => a.state === 'valid');
}

/**
 * Canal entre a aba da tarefa e a aba de assinatura. A assinatura acontece em OUTRA
 * aba; sem um aviso explícito, quem volta continua vendo o ícone vermelho de um
 * documento que acabou de assinar.
 *
 * É um sinal explícito de propósito: depender de `focus`/`visibilitychange` fez a tela
 * ficar desatualizada em janela sem foco — e não dá para provar em teste headless.
 */
export const CANAL_ASSINATURAS = 'septem-assinaturas';

export function avisarAssinatura(taskId: string): void {
  try { new BroadcastChannel(CANAL_ASSINATURAS).postMessage({ taskId }); }
  catch { /* navegador sem BroadcastChannel: a tela atualiza no próximo carregamento */ }
}

/**
 * Assina com certificado ICP-Brasil A1 (Fase 7b). O `.pfx` e a senha vão por HTTPS,
 * são usados só em memória no servidor e não são gravados em lugar nenhum — nem aqui:
 * nada de guardar em estado global, storage ou log.
 */
export function signWithCertificate(
  taskId: string, fieldKey: string, pfx: File, senha: string,
): Promise<DocSignature & { certSubject?: string; certIssuer?: string }> {
  const form = new FormData();
  form.append('certificate', pfx);
  form.append('password', senha);
  return api.postForm(
    `/api/v1/workflow/tasks/${taskId}/fields/${encodeURIComponent(fieldKey)}/sign-a1`, form);
}
