import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from 'lucide-react';

/**
 * Editor rich-text leve (contentEditable + execCommand) — sem dependência extra.
 * Usado no help_text popover (forms), nas orientações dos botões e no corpo dos
 * modelos de e-mail. Emite HTML. `onBlur` permite commitar só ao sair (evita
 * churn por tecla em quem persiste no onChange).
 */
export function RichTextEditor({
  value, onChange, onBlur,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza o HTML externo → editor. Roda quando `value` muda (ex.: ao EDITAR, o
  // corpo chega async DEPOIS do mount — antes o effect só rodava na montagem e o
  // conteúdo nunca era injetado). Nunca sobrescreve enquanto o usuário digita (editor
  // focado), senão o cursor pula; só atualiza quando o conteúdo de fato difere.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== (value ?? '')) {
      el.innerHTML = value ?? '';
    }
  }, [value]);

  // Ao focar um editor VAZIO, o Blink aplica o estilo de digitação "pendente" (ex.: um
  // negrito ligado em OUTRA instância do editor) ao 1º caractere — é o "começa em
  // negrito" do modelo novo. A limpeza precisa rodar DEPOIS do foco assentar (deferida):
  // no instante do onFocus a seleção ainda não está no editor e queryCommandState/
  // execCommand viram no-op. Já assentado, desligamos bold/itálico/sublinhado pendentes.
  const resetTypingStyle = () => {
    const el = ref.current;
    if (!el || el.textContent || document.activeElement !== el) return; // só editor vazio e focado
    for (const c of ['bold', 'italic', 'underline']) {
      try { if (document.queryCommandState(c)) document.execCommand(c, false); } catch { /* noop */ }
    }
    try { document.execCommand('removeFormat'); } catch { /* noop */ }
  };

  // Bloco/br "vazio" não deve virar conteúdo do modelo — normaliza para string vazia.
  const clean = (raw: string | undefined) => {
    const s = (raw ?? '').trim().toLowerCase();
    return s === '' || s === '<br>' || s === '<div><br></div>' || s === '<div></div>' || s === '<p><br></p>'
      ? '' : (raw ?? '');
  };

  const emit = () => onChange(clean(ref.current?.innerHTML));
  // Foca ANTES do comando — senão sem caret o execCommand (listas) não aplica.
  const exec = (cmd: string, arg?: string) => { ref.current?.focus(); document.execCommand(cmd, false, arg); emit(); };
  const addLink = () => { const url = window.prompt('URL do link:'); if (url) exec('createLink', url); };

  return (
    <div className="rounded-md border border-slate-300">
      <div className="flex gap-0.5 border-b border-slate-200 bg-slate-50 p-1">
        <Btn title="Negrito" onClick={() => exec('bold')}><Bold size={14} /></Btn>
        <Btn title="Itálico" onClick={() => exec('italic')}><Italic size={14} /></Btn>
        <Btn title="Sublinhado" onClick={() => exec('underline')}><Underline size={14} /></Btn>
        <span className="mx-1 w-px bg-slate-200" />
        <Btn title="Lista" onClick={() => exec('insertUnorderedList')}><List size={14} /></Btn>
        <Btn title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListOrdered size={14} /></Btn>
        <Btn title="Link" onClick={addLink}><Link2 size={14} /></Btn>
        <span className="mx-1 w-px bg-slate-200" />
        <Btn title="Limpar formatação" onClick={() => exec('removeFormat')}><Eraser size={14} /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => window.setTimeout(resetTypingStyle, 0)}
        onInput={emit}
        onBlur={() => onBlur?.(clean(ref.current?.innerHTML))}
        className="min-h-[120px] max-w-none p-2 text-sm focus:outline-none [&_a]:text-sky-600 [&_a]:underline [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}

function Btn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="rounded p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900">
      {children}
    </button>
  );
}
