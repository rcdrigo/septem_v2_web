import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser, Image as ImageIcon, Video, Code, Heading2, Heading3 } from 'lucide-react';

/**
 * Editor rich-text leve (contentEditable + execCommand) — sem dependência extra.
 * Usado no help_text popover (forms), nas orientações dos botões e no corpo dos
 * modelos de e-mail. Emite HTML. `onBlur` permite commitar só ao sair (evita
 * churn por tecla em quem persiste no onChange).
 *
 * `enableMedia` liga os botões de imagem/vídeo por URL e `enableHtmlSource` a edição
 * do HTML cru (Fase 10 — manuais). Ambos default OFF: os usos antigos não mudam. O
 * HTML é sempre sanitizado no backend, então inserir mídia/HTML aqui é seguro.
 */
export function RichTextEditor({
  value, onChange, onBlur, enableMedia = false, enableHtmlSource = false,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: (html: string) => void;
  enableMedia?: boolean;
  enableHtmlSource?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sourceMode, setSourceMode] = useState(false);

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
  // Título/subtítulo: aplica H2/H3 no bloco; clicar de novo no mesmo nível volta a parágrafo.
  const toggleHeading = (tag: 'H2' | 'H3') => {
    ref.current?.focus();
    let current = '';
    try { current = String(document.queryCommandValue('formatBlock') || ''); } catch { /* noop */ }
    document.execCommand('formatBlock', false, current.toUpperCase() === tag ? 'P' : tag);
    emit();
  };
  const addLink = () => { const url = window.prompt('URL do link:'); if (url) exec('createLink', url); };
  const addImage = () => { const url = window.prompt('URL da imagem:'); if (url) exec('insertImage', url); };
  const addVideo = () => {
    const url = window.prompt('URL do vídeo (YouTube ou Vimeo):');
    const embed = url && toEmbedUrl(url);
    if (embed) exec('insertHTML', `<iframe src="${embed}" allowfullscreen loading="lazy" title="Vídeo"></iframe>`);
    else if (url) window.alert('URL de vídeo não reconhecida. Use um link do YouTube ou Vimeo.');
  };

  return (
    <div className="rounded-md border border-slate-300" data-testid="rich-text-editor">
      <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50 p-1">
        <Btn title="Negrito" onClick={() => exec('bold')} disabled={sourceMode}><Bold size={14} /></Btn>
        <Btn title="Itálico" onClick={() => exec('italic')} disabled={sourceMode}><Italic size={14} /></Btn>
        <Btn title="Sublinhado" onClick={() => exec('underline')} disabled={sourceMode}><Underline size={14} /></Btn>
        <span className="mx-1 w-px bg-slate-200" />
        <Btn title="Título" onClick={() => toggleHeading('H2')} disabled={sourceMode}><Heading2 size={14} /></Btn>
        <Btn title="Subtítulo" onClick={() => toggleHeading('H3')} disabled={sourceMode}><Heading3 size={14} /></Btn>
        <span className="mx-1 w-px bg-slate-200" />
        <Btn title="Lista" onClick={() => exec('insertUnorderedList')} disabled={sourceMode}><List size={14} /></Btn>
        <Btn title="Lista numerada" onClick={() => exec('insertOrderedList')} disabled={sourceMode}><ListOrdered size={14} /></Btn>
        <Btn title="Link" onClick={addLink} disabled={sourceMode}><Link2 size={14} /></Btn>
        {enableMedia && <>
          <Btn title="Imagem por URL" onClick={addImage} disabled={sourceMode}><ImageIcon size={14} /></Btn>
          <Btn title="Vídeo por URL" onClick={addVideo} disabled={sourceMode}><Video size={14} /></Btn>
        </>}
        <span className="mx-1 w-px bg-slate-200" />
        <Btn title="Limpar formatação" onClick={() => exec('removeFormat')} disabled={sourceMode}><Eraser size={14} /></Btn>
        {enableHtmlSource && (
          <button
            type="button"
            data-testid="toggle-html-source"
            aria-pressed={sourceMode}
            title="Editar HTML"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSourceMode((on) => !on)}
            className={`ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${sourceMode ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            <Code size={14} /> HTML
          </button>
        )}
      </div>
      {sourceMode ? (
        <textarea
          data-testid="html-source"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onBlur?.(value ?? '')}
          spellCheck={false}
          className="min-h-[160px] w-full resize-y p-2 font-mono text-xs text-slate-800 focus:outline-none"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => window.setTimeout(resetTypingStyle, 0)}
          onInput={emit}
          onBlur={() => onBlur?.(clean(ref.current?.innerHTML))}
          className="min-h-[120px] max-w-none overflow-x-auto p-2 text-sm focus:outline-none [&_a]:text-sky-600 [&_a]:underline [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_img]:my-2 [&_img]:max-w-full [&_iframe]:my-2 [&_iframe]:aspect-video [&_iframe]:w-full [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
        />
      )}
    </div>
  );
}

/** Converte um link de YouTube/Vimeo em URL de embed; devolve null se não reconhecer. */
function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname.startsWith('/embed/')) return `https://www.youtube.com${u.pathname}`;
      const v = u.searchParams.get('v');
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (host === 'vimeo.com') { const id = u.pathname.split('/').filter(Boolean)[0]; return id ? `https://player.vimeo.com/video/${id}` : null; }
    if (host === 'player.vimeo.com') return u.href;
    return null;
  } catch { return null; }
}

function Btn({ onClick, title, children, disabled }: { onClick: () => void; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="rounded p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}
