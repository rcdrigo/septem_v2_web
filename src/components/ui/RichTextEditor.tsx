import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from 'lucide-react';

/**
 * Editor rich-text leve (contentEditable + execCommand) — sem dependência extra.
 * Usado no help_text popover (forms) e no corpo dos modelos de e-mail. Emite HTML.
 */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Seta o HTML inicial só na montagem (evita pular o cursor a cada digitação).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value ?? '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? '');
  const exec = (cmd: string, arg?: string) => { document.execCommand(cmd, false, arg); ref.current?.focus(); emit(); };
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
        onInput={emit}
        className="prose prose-sm min-h-[120px] max-w-none p-2 text-sm focus:outline-none"
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
