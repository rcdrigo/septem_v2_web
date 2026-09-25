import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { GuideManual } from '@/lib/api/manuals';
import './guide-widgets.css';

type SearchEntry = { manual: GuideManual; text: string; normalized: string };

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function textWithOffsets(value: string) {
  let normalized = '';
  const offsets: number[] = [];
  let sourceOffset = 0;

  for (const character of value) {
    const folded = normalize(character);
    normalized += folded;
    for (let index = 0; index < folded.length; index += 1) offsets.push(sourceOffset);
    sourceOffset += character.length;
  }
  offsets.push(value.length);
  return { normalized, offsets };
}

function matchRange(value: string, term: string): [number, number] | null {
  if (!term) return null;
  const { normalized, offsets } = textWithOffsets(value);
  const start = normalized.indexOf(term);
  if (start < 0) return null;
  return [offsets[start], offsets[start + term.length] ?? value.length];
}

function highlightedText(value: string, term: string): ReactNode {
  const range = matchRange(value, term);
  if (!range) return value;
  const [start, end] = range;
  return <>{value.slice(0, start)}<mark>{value.slice(start, end)}</mark>{value.slice(end)}</>;
}

function plainText(html: string | null) {
  if (!html) return '';
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  documentFragment.querySelectorAll('script, style').forEach(node => node.remove());
  documentFragment.querySelectorAll('p, h1, h2, h3, h4, li, br').forEach(node => node.append(' '));
  return (documentFragment.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function contentSnippet(text: string, term: string) {
  const match = matchRange(text, term);
  const matchStart = match?.[0] ?? 0;
  const start = Math.max(0, matchStart - 54);
  const end = Math.min(text.length, start + 170);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export function GuideSearch({ items, onOpen, sidebar = false }: { items: GuideManual[]; onOpen: (id: string) => void; sidebar?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const searchIndex = useMemo<SearchEntry[]>(() => items.map(manual => {
    const text = plainText(manual.contentHtml);
    return {
      manual,
      text,
      normalized: normalize(`${manual.title} ${manual.categoryName} ${text}`),
    };
  }), [items]);
  const term = normalize(query.trim());
  const matches = useMemo(
    () => term ? searchIndex.filter(item => item.normalized.includes(term)) : [],
    [searchIndex, term],
  );
  const results = matches.slice(0, 20);
  const visible = open && !!term;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('pt-BR') === 'k') {
        if (!inputRef.current?.getClientRects().length) return;
        event.preventDefault();
        inputRef.current.focus();
        setOpen(true);
      }
    };
    const handleOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSelected(-1);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    document.addEventListener('pointerdown', handleOutsidePress);
    return () => {
      document.removeEventListener('keydown', handleShortcut);
      document.removeEventListener('pointerdown', handleOutsidePress);
    };
  }, []);

  useEffect(() => { setSelected(-1); }, [query, items]);
  useEffect(() => {
    if (visible && selected >= 0) {
      document.getElementById(`${listId}-${selected}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [listId, selected, visible]);

  function choose(id: string) {
    setQuery('');
    setOpen(false);
    setSelected(-1);
    onOpen(id);
  }

  return (
    <div
      ref={containerRef}
      className={`guide-search${sidebar ? ' guide-search-sidebar' : ''}`}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setSelected(-1);
        }
      }}
    >
      <Search size={17} className="guide-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Buscar nos manuais"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        aria-activedescendant={visible && selected >= 0 && results[selected] ? `${listId}-${selected}` : undefined}
        data-testid="guide-busca"
        placeholder="Buscar nos manuais…"
        value={query}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setSelected(-1);
            setQuery('');
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            if (results.length) {
              setSelected(current => event.key === 'ArrowDown'
                ? (current + 1) % results.length
                : (current <= 0 ? results.length - 1 : current - 1));
            }
          } else if (event.key === 'Enter' && visible && results.length) {
            event.preventDefault();
            choose(results[Math.max(0, selected)].manual.id);
          }
        }}
      />
      <kbd aria-hidden="true">⌘ / Ctrl K</kbd>

      {visible && (
        <div className="guide-search-popover" data-testid="guide-busca-resultados">
          <p className="guide-search-count" role="status" aria-live="polite">
            {matches.length
              ? `${matches.length > results.length ? `${results.length} de ` : ''}${matches.length} resultado${matches.length === 1 ? '' : 's'}`
              : `Nada encontrado para “${query}”.`}
          </p>
          <ul id={listId} role="listbox" aria-label="Resultados da busca">
            {results.map(({ manual, text }, index) => {
              const snippet = contentSnippet(text, term);
              return (
                <li
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected === index}
                  key={manual.id}
                  data-testid="guide-busca-resultado"
                  onPointerMove={() => setSelected(index)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(manual.id)}
                >
                  <span className="guide-search-title">{highlightedText(manual.title, term)}</span>
                  <span className="guide-search-category">{highlightedText(manual.categoryName, term)}</span>
                  {text && <span className="guide-search-snippet">{highlightedText(snippet, term)}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
