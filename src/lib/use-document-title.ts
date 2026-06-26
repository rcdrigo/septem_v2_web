import { useEffect } from 'react';

/**
 * Define o título da aba conforme o conteúdo (tarefa, processo, página). Restaura
 * o título padrão ao desmontar.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Septem` : 'Septem';
    return () => { document.title = previous; };
  }, [title]);
}
