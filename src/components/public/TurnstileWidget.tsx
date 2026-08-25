import { useEffect, useRef, useState } from 'react';

/** API que o script do Turnstile pendura em `window`. */
type TurnstileApi = {
  render: (el: HTMLElement, opts: {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
    language?: string;
  }) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Carrega o script UMA vez por página, mesmo com vários widgets. */
function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existente = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existente) {
    return new Promise((ok, err) => {
      existente.addEventListener('load', () => ok());
      existente.addEventListener('error', () => err(new Error('turnstile')));
    });
  }
  return new Promise((ok, err) => {
    const tag = document.createElement('script');
    tag.id = SCRIPT_ID;
    tag.src = SCRIPT_SRC;
    tag.async = true;
    tag.defer = true;
    tag.onload = () => ok();
    tag.onerror = () => err(new Error('turnstile'));
    document.head.appendChild(tag);
  });
}

/**
 * Caixa "não sou um robô" do Cloudflare Turnstile (Fase 8).
 *
 * ⚠️ É CONVENIÊNCIA. Quem decide é o servidor, que revalida o token na Cloudflare a
 * cada envio — burlar o widget não adianta. Por isso uma falha ao carregar o script
 * não libera nada: apenas avisa, e o envio segue barrado pelo backend.
 */
export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    let id: string | undefined;
    carregarScript()
      .then(() => {
        if (!vivo || !caixaRef.current || !window.turnstile) return;
        id = window.turnstile.render(caixaRef.current, {
          sitekey: siteKey,
          language: 'pt-br',
          callback: (t) => onToken(t),
          // Token do Turnstile expira. Sem limpar aqui, a tela seguiria com um token
          // velho e o envio falharia com uma mensagem que não explica nada.
          'expired-callback': () => onToken(null),
          'error-callback': () => { setFalhou(true); onToken(null); },
        });
      })
      .catch(() => { if (vivo) { setFalhou(true); onToken(null); } });
    return () => { vivo = false; try { window.turnstile?.reset(id); } catch { /* já removido */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return (
    <div data-testid="turnstile">
      <div ref={caixaRef} />
      {falhou && (
        <p className="text-sm text-amber-700" data-testid="turnstile-erro">
          Não foi possível carregar a verificação de segurança. Recarregue a página para tentar de novo.
        </p>
      )}
    </div>
  );
}
