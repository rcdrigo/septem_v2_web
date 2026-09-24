import { createElement, useMemo, type ReactNode } from 'react';

// A summary is formatted content inside a clickable card/row, not an interactive
// document. Rebuild a small HTML vocabulary without copying attributes or URLs.
const formattingTags = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'del', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li', 'small', 'sub', 'sup', 'code', 'blockquote']);
const excludedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'template', 'noscript']);

function formattedNodes(parent: Node): ReactNode[] {
  return Array.from(parent.childNodes, (node, index) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof Element)) return null;
    const tag = node.localName;
    if (excludedTags.has(tag)) return null;
    const children = formattedNodes(node);
    if (!formattingTags.has(tag)) return children;
    return createElement(tag, { key: index }, ...(tag === 'br' ? [] : children));
  });
}

export function ExecutionSummary({ html, text, className = '', fallback = 'Sem resumo disponível.' }: {
  html?: string | null;
  text?: string | null;
  className?: string;
  fallback?: string;
}) {
  const content = useMemo(() => html ? formattedNodes(new DOMParser().parseFromString(html, 'text/html').body) : null, [html]);
  return <div title={text || undefined} className={`break-words [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal ${className}`}>{content ?? (text || fallback)}</div>;
}
