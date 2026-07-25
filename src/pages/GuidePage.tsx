import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, LifeBuoy, Search } from 'lucide-react';
import { useGuide, type GuideManual } from '@/lib/api/manuals';
import { useSessionStore } from '@/stores/session';
import { useDocumentTitle } from '@/lib/use-document-title';

const WELCOME_ID = 'comece-aqui';
type TabKey = 'interno' | 'externo' | 'tecnico';

/**
 * Guide público (Fase 10) — rota /guide, fora do AppShell (sem menus do app). Header
 * com logo + busca central, navbar Interno/Externo (só p/ interno logado) + Técnico
 * (por permissão), menu à esquerda, conteúdo ao centro com anterior/próximo e TOC à
 * direita. Abre por um botão no login. O conteúdo já vem sanitizado do backend.
 */
export function GuidePage() {
  const navigate = useNavigate();
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  // Rota fora do AppShell: bootstrap próprio p/ saber se há usuário interno logado
  // (a resposta do /guide muda conforme isso — abas Interno/Técnico).
  useEffect(() => { if (status === 'idle') void bootstrap(); }, [status, bootstrap]);

  const guide = useGuide();
  const d = guide.data;
  useDocumentTitle('Guia');

  const tabs = useMemo<{ key: TabKey; label: string; items: GuideManual[] }[]>(() => {
    if (!d) return [];
    const out: { key: TabKey; label: string; items: GuideManual[] }[] = [];
    if (d.isInternal) out.push({ key: 'interno', label: 'Interno', items: d.internal });
    out.push({ key: 'externo', label: 'Externo', items: d.external });
    if (d.canTechnical) out.push({ key: 'tecnico', label: 'Técnico', items: d.technical });
    return out;
  }, [d]);

  const [tab, setTab] = useState<TabKey>('externo');
  useEffect(() => { if (tabs.length && !tabs.some((t) => t.key === tab)) setTab(tabs[0].key); }, [tabs, tab]);
  const [activeId, setActiveId] = useState<string>(WELCOME_ID);
  const [query, setQuery] = useState('');

  const current = tabs.find((t) => t.key === tab);
  const items = current?.items ?? [];

  // Sequência linear (por categoria/ordem) para o anterior/próximo e para o menu.
  const ordered = useMemo(() => [...items].sort((a, b) =>
    a.categoryOrder - b.categoryOrder || a.categoryName.localeCompare(b.categoryName, 'pt-BR') || a.order - b.order || a.title.localeCompare(b.title, 'pt-BR')
  ), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((m) => m.title.toLowerCase().includes(q) || stripHtml(m.contentHtml).toLowerCase().includes(q));
  }, [ordered, query]);

  const active = ordered.find((m) => m.id === activeId) ?? null;
  const activeIndex = ordered.findIndex((m) => m.id === activeId);
  const prev = activeIndex > 0 ? ordered[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < ordered.length - 1 ? ordered[activeIndex + 1] : null;

  // TOC + injeção de ids nos títulos do conteúdo ativo + destaque do termo buscado.
  const { html: activeHtml, toc } = useMemo(() => buildContent(active?.contentHtml ?? '', query), [active?.contentHtml, query]);

  const openCategoryFirst = (firstManualId: string) => { setActiveId(firstManualId); scrollTop(); };
  const openManual = (mId: string) => { setActiveId(mId); scrollTop(); };

  // Ao trocar de aba, volta ao "Comece aqui".
  useEffect(() => { setActiveId(WELCOME_ID); }, [tab]);

  // Agrupa o menu por categoria (respeitando o filtro de busca).
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; order: number; items: GuideManual[] }>();
    for (const m of filtered) {
      const g = map.get(m.categoryId) ?? { name: m.categoryName, order: m.categoryOrder, items: [] };
      g.items.push(m); map.set(m.categoryId, g);
    }
    return [...map.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
  }, [filtered]);

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50">
      {/* Header: logo · busca · ações */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {d?.logoUrl ? <img src={d.logoUrl} alt={d.tenantName} className="h-8 w-auto" /> : <LifeBuoy className="text-slate-700" />}
          <span className="truncate text-base font-semibold text-slate-900">{d?.tenantName ?? 'Guia'}</span>
        </div>
        <div className="relative order-last w-full min-w-0 flex-1 sm:order-none sm:w-auto">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" data-testid="guide-busca" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nos manuais…"
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-500 focus:outline-none" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" data-testid="guide-voltar-login" onClick={() => navigate('/login')}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">
            <ChevronLeft size={15} /> Voltar ao login
          </button>
          <button type="button" data-testid="guide-ajuda" onClick={() => navigate('/login')}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700">
            <LifeBuoy size={15} /> Ainda precisa de ajuda?
          </button>
        </div>
      </header>

      {/* Navbar de abas (Interno/Externo/Técnico) */}
      {tabs.length > 1 && (
        <nav className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-4 py-2 sm:px-6" data-testid="guide-navbar">
          {tabs.map((t) => (
            <button key={t.key} type="button" aria-pressed={tab === t.key} data-testid={`guide-tab-${t.key}`} onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t.label}</button>
          ))}
        </nav>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Menu à esquerda */}
        <aside className="shrink-0 overflow-y-auto border-b border-slate-200 bg-white p-3 lg:w-64 lg:border-b-0 lg:border-r" data-testid="guide-menu">
          <button type="button" onClick={() => openManual(WELCOME_ID)}
            className={`mb-2 block w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${activeId === WELCOME_ID ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}>
            Comece aqui
          </button>
          {byCategory.map((cat) => (
            <div key={cat.name} className="mb-3">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{cat.name}</p>
              {groupByParent(cat.items).map((node) => (
                <div key={node.manual.id}>
                  <MenuLink m={node.manual} activeId={activeId} query={query} onClick={openManual} />
                  {node.children.map((child) => (
                    <div key={child.id} className="pl-3"><MenuLink m={child} activeId={activeId} query={query} onClick={openManual} /></div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {byCategory.length === 0 && query && <p className="px-3 py-2 text-xs text-slate-400">Nada encontrado para "{query}".</p>}
        </aside>

        {/* Conteúdo ao centro */}
        <main id="guide-scroll" className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {guide.isLoading ? (
            <p className="text-sm text-slate-400">Carregando…</p>
          ) : activeId === WELCOME_ID ? (
            <Welcome welcome={d?.welcome} onOpenCategory={openCategoryFirst} />
          ) : active ? (
            <article className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-bold text-slate-900">{active.title}</h1>
              <div
                data-testid="guide-conteudo"
                className="prose-guide mt-4 max-w-none text-slate-700 [&_a]:text-sky-600 [&_a]:underline [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_iframe]:my-3 [&_iframe]:aspect-video [&_iframe]:w-full [&_img]:my-3 [&_img]:max-w-full [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-3"
                dangerouslySetInnerHTML={{ __html: activeHtml }}
              />
              <nav className="mt-10 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
                {prev ? (
                  <button type="button" data-testid="guide-anterior" onClick={() => openManual(prev.id)}
                    className="inline-flex min-w-0 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <ArrowLeft size={15} className="shrink-0" /><span className="truncate">{prev.title}</span>
                  </button>
                ) : <span />}
                {next ? (
                  <button type="button" data-testid="guide-proximo" onClick={() => openManual(next.id)}
                    className="inline-flex min-w-0 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <span className="truncate">{next.title}</span><ArrowRight size={15} className="shrink-0" />
                  </button>
                ) : <span />}
              </nav>
            </article>
          ) : (
            <p className="text-sm text-slate-400">Selecione um manual no menu.</p>
          )}
        </main>

        {/* TOC à direita */}
        {activeId !== WELCOME_ID && toc.length > 0 && (
          <aside className="hidden shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block xl:w-56" data-testid="guide-toc">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nesta página</p>
            <ul className="space-y-1 text-sm">
              {toc.map((h) => (
                <li key={h.id} style={{ paddingLeft: (h.level - 2) * 10 }}>
                  <a href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                    className="block truncate text-slate-600 hover:text-slate-900">{h.text}</a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function MenuLink({ m, activeId, query, onClick }: { m: GuideManual; activeId: string; query: string; onClick: (id: string) => void }) {
  return (
    <button type="button" data-testid="guide-menu-item" onClick={() => onClick(m.id)}
      className={`block w-full truncate rounded-md px-3 py-1.5 text-left text-sm ${activeId === m.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
      {highlight(m.title, query)}
    </button>
  );
}

function Welcome({ welcome, onOpenCategory }: { welcome?: { title: string; description: string; categories: { id: string; name: string; firstManualId: string }[] }; onOpenCategory: (firstManualId: string) => void }) {
  if (!welcome) return null;
  return (
    <div className="mx-auto max-w-3xl" data-testid="guide-welcome">
      <h1 className="text-2xl font-bold text-slate-900">{welcome.title}</h1>
      <p className="mt-3 text-slate-600">{welcome.description}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {welcome.categories.map((c) => (
          <button key={c.id} type="button" data-testid="guide-welcome-categoria" onClick={() => onOpenCategory(c.firstManualId)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">{c.name}</span>
            <span className="mt-1 block text-sm text-slate-500">Ver manuais desta categoria →</span>
          </button>
        ))}
        {welcome.categories.length === 0 && <p className="text-sm text-slate-400">Nenhum manual publicado ainda.</p>}
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function scrollTop() { document.getElementById('guide-scroll')?.scrollTo({ top: 0 }); }

function stripHtml(html: string | null): string {
  if (!html) return '';
  const el = document.createElement('div'); el.innerHTML = html; return el.textContent ?? '';
}

/**
 * Injeta ids nos títulos (h2–h4) do conteúdo, monta o TOC e — quando há busca ativa —
 * destaca o termo no CORPO do manual (só em nós de texto do HTML já sanitizado, então
 * não quebra tags nem re-introduz HTML do usuário). O `<mark>` usa a mesma cor do menu.
 */
function buildContent(html: string, query = ''): { html: string; toc: { id: string; text: string; level: number }[] } {
  if (!html) return { html: '', toc: [] };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const toc: { id: string; text: string; level: number }[] = [];
  doc.querySelectorAll('h2, h3, h4').forEach((h, i) => {
    const level = Number(h.tagName[1]);
    const text = h.textContent?.trim() ?? '';
    if (!text) return;
    const id = `sec-${i}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
    h.id = id;
    toc.push({ id, text, level });
  });
  const term = query.trim();
  if (term) highlightTextNodes(doc.body, term);
  return { html: doc.body.innerHTML, toc };
}

/** Envolve as ocorrências de `term` (case-insensitive) em &lt;mark&gt;, só em text nodes. */
function highlightTextNodes(root: HTMLElement, term: string) {
  const lower = term.toLowerCase();
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  // Coleta primeiro (mutar durante o walk invalidaria o cursor).
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.toLowerCase().includes(lower)) targets.push(node as Text);
  }
  for (const text of targets) {
    const value = text.nodeValue ?? '';
    const frag = root.ownerDocument.createDocumentFragment();
    let i = 0;
    for (let idx = value.toLowerCase().indexOf(lower); idx >= 0; idx = value.toLowerCase().indexOf(lower, i)) {
      if (idx > i) frag.appendChild(root.ownerDocument.createTextNode(value.slice(i, idx)));
      const mark = root.ownerDocument.createElement('mark');
      mark.className = 'rounded bg-amber-200 px-0.5';
      mark.textContent = value.slice(idx, idx + term.length);
      frag.appendChild(mark);
      i = idx + term.length;
    }
    if (i < value.length) frag.appendChild(root.ownerDocument.createTextNode(value.slice(i)));
    text.parentNode?.replaceChild(frag, text);
  }
}

function groupByParent(items: GuideManual[]): { manual: GuideManual; children: GuideManual[] }[] {
  const byId = new Map(items.map((m) => [m.id, m]));
  const roots: GuideManual[] = [];
  const childrenOf = new Map<string, GuideManual[]>();
  for (const m of items) {
    if (m.parentId && byId.has(m.parentId)) {
      const arr = childrenOf.get(m.parentId) ?? []; arr.push(m); childrenOf.set(m.parentId, arr);
    } else roots.push(m);
  }
  return roots.map((manual) => ({ manual, children: (childrenOf.get(manual.id) ?? []).sort((a, b) => a.order - b.order) }));
}

/** Destaca o termo buscado no texto (case-insensitive), sem usar innerHTML. */
function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (<>
    {text.slice(0, idx)}
    <mark className="rounded bg-amber-200 px-0.5">{text.slice(idx, idx + q.length)}</mark>
    {text.slice(idx + q.length)}
  </>);
}
