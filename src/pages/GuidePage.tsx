import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LifeBuoy,
  Menu,
  X,
} from 'lucide-react';
import { GuideMenu } from '@/components/guide/GuideMenu';
import { GuideSearch } from '@/components/guide/GuideSearch';
import { GuideToc } from '@/components/guide/GuideToc';
import { useGuide, type GuideManual } from '@/lib/api/manuals';
import { useSessionStore } from '@/stores/session';
import { useDocumentTitle } from '@/lib/use-document-title';
import '@/components/guide/guide.css';

const WELCOME_ID = 'comece-aqui';
type TabKey = 'interno' | 'externo' | 'tecnico';
type CopyStatus = 'idle' | 'copied' | 'error';

const TECHNICAL_MANUAL_TITLES: Record<string, string> = {
  'modelador-processos': 'Modelador de processos',
  'modelador-formularios': 'Modelador de formulários',
};

const SECTION_TITLES: Record<string, string[]> = {
  'responsaveis-prazos': ['Responsáveis e prazos'],
  'botoes-acao': ['Botões de ação'],
  'salvar-publicar': ['Salvando, testando e publicando', 'Salvar e publicar'],
};

/**
 * Guia público, fora do AppShell. A aba e o manual selecionados vivem na URL para
 * que recarregar, compartilhar e usar voltar/avançar preserve o contexto de leitura.
 */
export function GuidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const status = useSessionStore((state) => state.status);
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  const guide = useGuide();
  const data = guide.data;
  useDocumentTitle('Guia');

  const tabs = useMemo<{ key: TabKey; label: string; items: GuideManual[] }[]>(() => {
    if (!data) return [];
    const available: { key: TabKey; label: string; items: GuideManual[] }[] = [];
    if (data.isInternal) available.push({ key: 'interno', label: 'Interno', items: data.internal });
    available.push({ key: 'externo', label: 'Externo', items: data.external });
    if (data.canTechnical) available.push({ key: 'tecnico', label: 'Técnico', items: data.technical });
    return available;
  }, [data]);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedTab = params.get('tab');
  const defaultTab = tabs.find((item) => item.key === 'externo')?.key ?? tabs[0]?.key ?? 'externo';
  const tab = tabs.some((item) => item.key === requestedTab)
    ? requestedTab as TabKey
    : defaultTab;
  const current = tabs.find((item) => item.key === tab);
  const items = current?.items ?? [];

  const ordered = useMemo(() => [...items].sort((left, right) =>
    left.categoryOrder - right.categoryOrder
      || left.categoryName.localeCompare(right.categoryName, 'pt-BR')
      || left.order - right.order
      || left.title.localeCompare(right.title, 'pt-BR')
  ), [items]);

  const requestedManual = params.get('manual');
  const requestedManualKey = params.get('manualKey');
  const manualFromKey = tab === 'tecnico' && requestedManualKey
    ? resolveTechnicalManual(ordered, requestedManualKey)
    : null;
  const requestedManualExists = requestedManual === WELCOME_ID || ordered.some((manual) => manual.id === requestedManual);
  const activeId: string = requestedManualExists
    ? requestedManual!
    : manualFromKey?.id ?? WELCOME_ID;
  const active = ordered.find((manual) => manual.id === activeId) ?? null;
  const activeIndex = ordered.findIndex((manual) => manual.id === activeId);
  const previous = activeIndex > 0 ? ordered[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < ordered.length - 1 ? ordered[activeIndex + 1] : null;
  const { html: activeHtml, toc } = useMemo(() => buildContent(active?.contentHtml ?? ''), [active?.contentHtml]);
  const trail = useMemo(() => active ? getManualTrail(active, ordered) : [], [active, ordered]);

  const welcomeCategories = useMemo(() => {
    const categories = new Map<string, { id: string; name: string; order: number; firstManualId: string }>();
    for (const manual of ordered) {
      if (!categories.has(manual.categoryId)) {
        categories.set(manual.categoryId, {
          id: manual.categoryId,
          name: manual.categoryName,
          order: manual.categoryOrder,
          firstManualId: manual.id,
        });
      }
    }
    return [...categories.values()].sort((left, right) =>
      left.order - right.order || left.name.localeCompare(right.name, 'pt-BR')
    );
  }, [ordered]);

  // Corrige URLs incompletas ou que apontem para uma aba sem permissão sem criar
  // uma entrada extra no histórico.
  useEffect(() => {
    if (!tabs.length) return;
    const resolvedContextLink = !requestedManual && manualFromKey?.id === activeId;
    if (requestedTab === tab && (requestedManual === activeId || resolvedContextLink)) return;
    navigate({
      pathname: location.pathname,
      search: selectionSearch(params, tab, activeId),
      hash: requestedManual === activeId ? location.hash : '',
    }, { replace: true });
  }, [activeId, location.hash, location.pathname, manualFromKey?.id, navigate, params, requestedManual, requestedTab, tab, tabs.length]);

  useEffect(() => {
    setCopyStatus('idle');
    if (guide.isLoading) return;
    const frame = requestAnimationFrame(() => {
      const root = document.getElementById('guide-scroll');
      let id = '';
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* URL malformada: abre o início do artigo. */ }
      const requestedSection = params.get('section');
      const sectionId = !id && requestedSection ? resolveSectionId(toc, requestedSection) : '';
      const target = document.getElementById(id || sectionId);
      if (target && root?.contains(target)) target.scrollIntoView({ block: 'start' });
      else scrollTop();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId, activeHtml, guide.isLoading, location.hash, params, tab, toc]);

  const select = (nextTab: TabKey, manualId: string) => {
    navigate({
      pathname: location.pathname,
      search: selectionSearch(params, nextTab, manualId),
      hash: '',
    });
  };

  const openManual = (manualId: string) => select(tab, manualId);
  const selectHeading = (id: string) => {
    const hash = `#${encodeURIComponent(id)}`;
    if (hash === location.hash) {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    } else {
      navigate({ pathname: location.pathname, search: location.search, hash });
    }
  };
  const openFromDrawer = (manualId: string) => {
    openManual(manualId);
    setMenuOpen(false);
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <div className="guide-page flex h-[100dvh] min-w-0 flex-col bg-slate-50 text-slate-900">
      <header className="guide-header shrink-0 border-b border-slate-200 bg-white">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(12rem,1fr)_minmax(18rem,32rem)_minmax(12rem,1fr)]">
          <div className="flex min-w-0 items-center gap-2.5">
            {data?.logoUrl
              ? <img src={data.logoUrl} alt={data.tenantName} className="h-8 max-w-36 shrink-0 object-contain sm:max-w-52" />
              : <LifeBuoy className="shrink-0 text-slate-700" aria-hidden="true" />}
            <span className="truncate text-base font-semibold text-slate-900">{data?.tenantName ?? 'Guia'}</span>
          </div>

          <div className="col-span-full row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <GuideSearch items={ordered} onOpen={openManual} />
          </div>

          <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1.5 lg:col-start-3 lg:row-start-1">
            <button
              type="button"
              data-testid="guide-voltar-login"
              aria-label="Voltar ao login"
              onClick={() => navigate('/login')}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-2.5 text-sm text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-100 sm:px-3"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              <span className="hidden xl:inline">Voltar ao login</span>
            </button>
            <button
              type="button"
              data-testid="guide-ajuda"
              aria-label="Ainda precisa de ajuda?"
              onClick={() => navigate('/login')}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2.5 text-sm font-semibold text-white outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-800 sm:px-3"
            >
              <LifeBuoy size={15} aria-hidden="true" />
              <span className="hidden xl:inline">Ainda precisa de ajuda?</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 ${tabs.length <= 1 ? 'lg:hidden' : ''}`}>
        <button
          ref={menuTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-100 lg:hidden"
        >
          <Menu size={16} aria-hidden="true" /> Menu
        </button>

        {tabs.length > 1 && (
          <nav className="flex min-w-0 gap-1 overflow-x-auto" data-testid="guide-navbar" aria-label="Áreas do guia">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={tab === item.key}
                data-testid={`guide-tab-${item.key}`}
                onClick={() => select(item.key, WELCOME_ID)}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 ${
                  tab === item.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 lg:block" data-testid="guide-menu">
          <GuideMenu items={ordered} activeId={activeId} onOpen={openManual} welcomeId={WELCOME_ID} />
        </aside>

        <div className="guide-content-grid min-h-0 min-w-0 flex-1">
          {activeId !== WELCOME_ID && <GuideToc toc={toc} contentKey={`${tab}:${activeId}`} onSelect={selectHeading} />}

          <main id="guide-scroll" className="guide-main min-h-0 min-w-0 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
            {guide.isLoading ? (
              <p className="mx-auto max-w-3xl text-sm text-slate-500" role="status">Carregando…</p>
            ) : guide.isError ? (
              <div className="mx-auto max-w-3xl" role="alert">
                <h1 className="text-2xl font-semibold text-slate-900">Não foi possível carregar o guia</h1>
                <p className="mt-2 text-slate-600">Atualize a página para tentar novamente.</p>
              </div>
            ) : activeId === WELCOME_ID ? (
              <Welcome
                welcome={data?.welcome ? {
                  title: data.welcome.title,
                  description: data.welcome.description,
                  categories: welcomeCategories,
                } : undefined}
                onOpenCategory={openManual}
              />
            ) : active ? (
              <article className="mx-auto w-full max-w-3xl min-w-0 pb-8">
                <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 pb-5">
                  <Breadcrumbs
                    active={active}
                    trail={trail}
                    categoryFirstId={ordered.find((manual) => manual.categoryId === active.categoryId)?.id}
                    onOpen={openManual}
                  />
                  <button
                    type="button"
                    data-testid="guide-copiar-link"
                    onClick={() => void copyLink()}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 outline-none hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-100 sm:px-3 sm:text-sm"
                  >
                    {copyStatus === 'copied' ? <Check size={15} aria-hidden="true" /> : copyStatus === 'error' ? <AlertCircle size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    <span aria-live="polite">{copyStatus === 'copied' ? 'Link copiado' : copyStatus === 'error' ? 'Falha ao copiar' : 'Copiar link'}</span>
                  </button>
                </div>

                <h1 className="mt-8 min-w-0 break-words text-3xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl">
                  {active.title}
                </h1>
                <div
                  data-testid="guide-conteudo"
                  className="guide-prose mt-7 min-w-0 max-w-none text-base leading-7 text-slate-700"
                  dangerouslySetInnerHTML={{ __html: activeHtml }}
                />

                <nav className="mt-12 grid min-w-0 gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2" aria-label="Artigos adjacentes">
                  {previous ? (
                    <button
                      type="button"
                      data-testid="guide-anterior"
                      onClick={() => openManual(previous.id)}
                      className="group flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left outline-none hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-100"
                    >
                      <ArrowLeft size={17} className="shrink-0 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-slate-500">Anterior</span>
                        <span className="block truncate whitespace-nowrap text-sm font-semibold text-slate-800">{previous.title}</span>
                      </span>
                    </button>
                  ) : <span />}
                  {next ? (
                    <button
                      type="button"
                      data-testid="guide-proximo"
                      onClick={() => openManual(next.id)}
                      className="group flex min-w-0 items-center justify-end gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-right outline-none hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-100 sm:col-start-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-slate-500">Próximo</span>
                        <span className="block truncate whitespace-nowrap text-sm font-semibold text-slate-800">{next.title}</span>
                      </span>
                      <ArrowRight size={17} className="shrink-0 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
                    </button>
                  ) : <span />}
                </nav>
              </article>
            ) : (
              <p className="mx-auto max-w-3xl text-sm text-slate-500">Selecione um manual no menu.</p>
            )}
          </main>
        </div>
      </div>

      <MobileGuideMenu
        open={menuOpen}
        triggerRef={menuTriggerRef}
        items={ordered}
        activeId={activeId}
        onOpen={openFromDrawer}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}

function MobileGuideMenu({
  open,
  triggerRef,
  items,
  activeId,
  onOpen,
  onClose,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  items: GuideManual[];
  activeId: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      wasOpen.current = true;
      return;
    }

    if (dialog.open) dialog.close();
    if (wasOpen.current) {
      wasOpen.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [open, triggerRef]);

  return (
    <dialog
      ref={dialogRef}
      className="guide-mobile-dialog"
      aria-labelledby="guide-mobile-menu-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="guide-mobile-dialog-panel">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="guide-mobile-menu-title" className="text-base font-semibold text-slate-900">Menu</h2>
          <button
            type="button"
            autoFocus
            aria-label="Fechar menu"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-md text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 active:bg-slate-200"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="guide-menu-mobile">
          <GuideMenu items={items} activeId={activeId} onOpen={onOpen} welcomeId={WELCOME_ID} />
        </div>
      </div>
    </dialog>
  );
}

function Breadcrumbs({
  active,
  trail,
  categoryFirstId,
  onOpen,
}: {
  active: GuideManual;
  trail: GuideManual[];
  categoryFirstId?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <nav className="min-w-0 flex-1 overflow-x-auto" aria-label="Caminho do artigo">
      <ol className="flex w-max min-w-full items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
        <li>
          <button type="button" onClick={() => onOpen(WELCOME_ID)} className="whitespace-nowrap rounded px-1 py-1 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500">Guia</button>
        </li>
        <BreadcrumbSeparator />
        <li>
          <button type="button" onClick={() => categoryFirstId && onOpen(categoryFirstId)} disabled={!categoryFirstId} className="max-w-44 truncate whitespace-nowrap rounded px-1 py-1 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-default">
            {active.categoryName}
          </button>
        </li>
        {trail.map((manual, index) => (
          <FragmentBreadcrumb key={manual.id} manual={manual} current={index === trail.length - 1} onOpen={onOpen} />
        ))}
      </ol>
    </nav>
  );
}

function FragmentBreadcrumb({ manual, current, onOpen }: { manual: GuideManual; current: boolean; onOpen: (id: string) => void }) {
  return (
    <>
      <BreadcrumbSeparator />
      <li>
        {current
          ? <span aria-current="page" className="block max-w-48 truncate whitespace-nowrap px-1 py-1 font-medium text-slate-800">{manual.title}</span>
          : (
            <button type="button" onClick={() => onOpen(manual.id)} className="block max-w-44 truncate whitespace-nowrap rounded px-1 py-1 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500">
              {manual.title}
            </button>
          )}
      </li>
    </>
  );
}

function BreadcrumbSeparator() {
  return <li aria-hidden="true"><ChevronRight size={13} /></li>;
}

function Welcome({
  welcome,
  onOpenCategory,
}: {
  welcome?: {
    title: string;
    description: string;
    categories: { id: string; name: string; firstManualId: string }[];
  };
  onOpenCategory: (firstManualId: string) => void;
}) {
  if (!welcome) return null;
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 pb-8" data-testid="guide-welcome">
      <p className="text-sm font-medium text-slate-500">Guia</p>
      <h1 className="mt-3 min-w-0 break-words text-3xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl">{welcome.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{welcome.description}</p>
      <div className="mt-9 divide-y divide-slate-200 border-y border-slate-200">
        {welcome.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            data-testid="guide-welcome-categoria"
            onClick={() => onOpenCategory(category.firstManualId)}
            className="group flex min-h-16 w-full min-w-0 items-center justify-between gap-4 px-1 py-3 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500 active:bg-slate-200 sm:px-3"
          >
            <span className="min-w-0 truncate whitespace-nowrap font-semibold text-slate-800">{category.name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-slate-500 group-hover:text-slate-900">
              Abrir <ArrowRight size={15} aria-hidden="true" />
            </span>
          </button>
        ))}
        {welcome.categories.length === 0 && <p className="py-5 text-sm text-slate-500">Nenhum manual publicado ainda.</p>}
      </div>
    </div>
  );
}

function selectionSearch(current: URLSearchParams, tab: TabKey, manualId: string): string {
  const next = new URLSearchParams(current);
  next.set('tab', tab);
  next.set('manual', manualId);
  next.delete('manualKey');
  next.delete('section');
  return `?${next.toString()}`;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveTechnicalManual(items: GuideManual[], key: string): GuideManual | null {
  const expectedTitle = TECHNICAL_MANUAL_TITLES[key];
  if (!expectedTitle) return null;
  const expected = normalizeKey(expectedTitle);
  return items.find((manual) => normalizeKey(manual.title) === expected) ?? null;
}

function resolveSectionId(toc: { id: string; text: string }[], key: string): string {
  const titles = SECTION_TITLES[key] ?? [key];
  const normalizedTitles = new Set(titles.map(normalizeKey));
  return toc.find((heading) => normalizedTitles.has(normalizeKey(heading.text)))?.id ?? '';
}

function scrollTop() {
  document.getElementById('guide-scroll')?.scrollTo({ top: 0 });
}

function getManualTrail(active: GuideManual, items: GuideManual[]): GuideManual[] {
  const byId = new Map(items.map((manual) => [manual.id, manual]));
  const trail: GuideManual[] = [];
  const seen = new Set<string>();
  let current: GuideManual | undefined = active;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return trail;
}

/** Adds stable section ids and local scroll wrappers to sanitized backend HTML. */
function buildContent(html: string): { html: string; toc: { id: string; text: string; level: number }[] } {
  if (!html) return { html: '', toc: [] };
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const toc: { id: string; text: string; level: number }[] = [];

  documentNode.querySelectorAll('h2, h3, h4').forEach((heading, index) => {
    const level = Number(heading.tagName[1]);
    const text = heading.textContent?.trim() ?? '';
    if (!text) return;
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const id = `sec-${index}-${slug || 'secao'}`;
    heading.id = id;
    toc.push({ id, text, level });
  });

  documentNode.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('guide-table-scroll')) return;
    const wrapper = documentNode.createElement('div');
    wrapper.className = 'guide-table-scroll';
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  return { html: documentNode.body.innerHTML, toc };
}
