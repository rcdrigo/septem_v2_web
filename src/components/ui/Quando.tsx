/**
 * Data/hora no FUSO de quem está vendo, curta na tela e COMPLETA ao passar o mouse (e para leitor
 * de tela) — requisito transversal do plano 26_09: "data/hora no fuso do usuário, com a data/hora
 * completa consultável". Um componente só, para o formato não ser reescrito em cada tela.
 */
export function Quando({ iso, so = 'data-hora', className }: {
  iso: string;
  /** `data` mostra só o dia (prazos); a dica continua completa. */
  so?: 'data-hora' | 'data';
  className?: string;
}) {
  const d = new Date(iso);
  const curta = so === 'data'
    ? d.toLocaleDateString('pt-BR')
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const completa = d.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'long' });
  return <time dateTime={iso} title={completa} className={className}>{curta}</time>;
}
