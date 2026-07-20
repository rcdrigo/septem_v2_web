const POPUP_BLOCKED_MESSAGE =
  'O navegador bloqueou a abertura do documento. Libere pop-ups para este site e tente novamente.';

export class DocumentWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentWindowError';
  }
}

/**
 * Reserva uma aba enquanto a ativação do clique ainda está disponível. O navegador
 * pode bloquear window.open depois do primeiro await, mesmo que a requisição termine
 * normalmente, por isso esta função precisa ser chamada antes de iniciar o fetch.
 */
export function reserveDocumentWindow(loadingMessage = 'Preparando documento…') {
  // Não passe `noopener` como feature: alguns navegadores devolveriam null mesmo com
  // a aba aberta. Removemos o opener imediatamente e mantemos a referência da janela.
  const target = window.open('about:blank', '_blank');
  if (!target) throw new DocumentWindowError(POPUP_BLOCKED_MESSAGE);
  target.opener = null;

  try {
    target.document.title = loadingMessage;
    const body = target.document.body;
    body.replaceChildren();
    body.style.cssText =
      'margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;' +
      'color:#334155;font:500 16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    const status = target.document.createElement('p');
    status.textContent = loadingMessage;
    body.append(status);
  } catch {
    // A aba já está reservada; falhar ao desenhar o estado de espera não impede o arquivo.
  }

  let objectUrl: string | null = null;

  return {
    show(blob: Blob) {
      if (target.closed)
        throw new DocumentWindowError('A janela do documento foi fechada antes da conclusão.');

      objectUrl = URL.createObjectURL(blob);
      try {
        target.location.replace(objectUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        throw error;
      }

      const urlToRevoke = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 60_000);
    },

    close() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      try { if (!target.closed) target.close(); }
      catch { /* fechamento best-effort */ }
    },
  };
}

