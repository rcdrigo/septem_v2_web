import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { TagActor } from '@/lib/api/tags';
import { useTagsAccess } from '@/lib/api/tags';
import { tagColorStyle } from './tagColor';

export type TagPillItem = {
  id: string | number;
  name: string;
  color?: string | null;
  addedBy?: TagActor | null;
  /** Compatibility with projections that flatten the actor. */
  addedByName?: string | null;
  addedAt?: string | null;
};

export type TagPillsProps = {
  tags?: readonly TagPillItem[];
  className?: string;
  leadingPills?: ReactNode;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function formatDate(value?: string | null): string {
  if (!value) return 'data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function tooltipText(tag: TagPillItem): string {
  const author = tag.addedBy?.name ?? tag.addedByName ?? 'usuário não informado';
  return `Adicionado por ${author} em ${formatDate(tag.addedAt)}`;
}

function tooltipHtml(tag: TagPillItem): string {
  return escapeHtml(tooltipText(tag));
}

export function TagPills({ tags = [], className = '', leadingPills }: TagPillsProps) {
  const hasAccess = useTagsAccess();
  const visibleTags = hasAccess ? tags : [];
  const hasContent = !!leadingPills || visibleTags.length > 0;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 1);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const element = scrollerRef.current;
    if (!element) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateArrows);
    observer?.observe(element);
    Array.from(element.children).forEach((child) => observer?.observe(child));
    return () => observer?.disconnect();
  }, [tags, hasAccess, leadingPills, hasContent, updateArrows]);

  if (!hasContent) return null;

  function scrollBy(direction: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' });
  }

  return (
    <div className={`relative flex min-w-0 items-center ${className}`} aria-label={leadingPills ? 'Indicadores e tags' : 'Tags associadas'} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Rolar tags para a esquerda"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); scrollBy(-1); }}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute left-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      )}

      <div
        ref={scrollerRef}
        onScroll={updateArrows}
        onPointerDown={(event) => event.stopPropagation()}
        className="flex min-w-0 flex-1 touch-pan-x items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>[data-testid=tooltip-wrap]]:shrink-0"
      >
        {leadingPills}
        {visibleTags.map((tag) => (
          <Tooltip key={tag.id} text={tooltipHtml(tag)}>
            <button
              type="button"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
              onKeyDown={(event) => event.stopPropagation()}
              className="inline-flex min-h-7 max-w-48 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700"
              style={tagColorStyle(tag.color)}
              aria-label={`${tag.name}. ${tooltipText(tag)}`}
            >
              <span className="truncate">{tag.name}</span>
            </button>
          </Tooltip>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          aria-label="Rolar tags para a direita"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); scrollBy(1); }}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute right-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-700"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
