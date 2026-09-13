/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { GuideManual } from '@/lib/api/manuals';

export interface GuideMenuProps {
  items: GuideManual[];
  activeId: string;
  onOpen: (id: string) => void;
  welcomeId?: string;
}

type ManualNode = {
  manual: GuideManual;
  children: ManualNode[];
};

type CategoryNode = {
  id: string;
  name: string;
  nodes: ManualNode[];
};

type MenuTree = {
  categories: CategoryNode[];
  categoryByManual: Map<string, string>;
  parentByManual: Map<string, string>;
};

const categoryKey = (id: string) => `category:${id}`;
const manualKey = (id: string) => `manual:${id}`;

/**
 * Navigation tree for the public guide. The API already supplies an ordered list;
 * this component preserves that order while making the parent relation recursive.
 */
export function GuideMenu({
  items,
  activeId,
  onOpen,
  welcomeId = 'comece-aqui',
}: GuideMenuProps) {
  const tree = useMemo(() => buildMenuTree(items), [items]);
  const signature = useMemo(
    () => items.map((item) => `${item.categoryId}:${item.id}:${item.parentId ?? ''}`).join('|'),
    [items],
  );
  const initializedSignature = useRef('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set);
  const baseId = useId();

  useEffect(() => {
    setExpanded((current) => {
      const next = initializedSignature.current === signature
        ? new Set(current)
        : defaultExpandedKeys(tree);

      const activeCategory = tree.categoryByManual.get(activeId);
      if (activeCategory) next.add(categoryKey(activeCategory));

      const visited = new Set<string>();
      let parentId = tree.parentByManual.get(activeId);
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        next.add(manualKey(parentId));
        parentId = tree.parentByManual.get(parentId);
      }

      return next;
    });
    initializedSignature.current = signature;
  }, [activeId, signature, tree]);

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <nav aria-label="Navegação do guia" className="px-3 py-4">
      <button
        type="button"
        aria-current={activeId === welcomeId ? 'page' : undefined}
        onClick={() => onOpen(welcomeId)}
        className={`mb-4 flex min-h-9 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
          activeId === welcomeId
            ? 'bg-slate-200 text-slate-950'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200'
        }`}
      >
        <Home size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate">Comece aqui</span>
      </button>

      {tree.categories.length > 0 ? (
        <ul className="space-y-3">
          {tree.categories.map((category) => {
            const key = categoryKey(category.id);
            const isExpanded = expanded.has(key);
            const contentId = `${baseId}-category-${encodeURIComponent(category.id)}`;

            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-controls={contentId}
                  aria-expanded={isExpanded}
                  onClick={() => toggle(key)}
                  className="flex min-h-9 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-xs font-semibold text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:bg-slate-200"
                >
                  <ChevronRight
                    size={14}
                    className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{category.name}</span>
                </button>

                {isExpanded && (
                  <ul id={contentId} className="mt-1 space-y-0.5">
                    {category.nodes.map((node) => (
                      <ManualBranch
                        key={node.manual.id}
                        node={node}
                        depth={0}
                        activeId={activeId}
                        expanded={expanded}
                        baseId={baseId}
                        onOpen={onOpen}
                        onToggle={toggle}
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-2.5 py-2 text-xs text-slate-500">Nenhum manual disponível.</p>
      )}
    </nav>
  );
}

function ManualBranch({
  node,
  depth,
  activeId,
  expanded,
  baseId,
  onOpen,
  onToggle,
}: {
  node: ManualNode;
  depth: number;
  activeId: string;
  expanded: Set<string>;
  baseId: string;
  onOpen: (id: string) => void;
  onToggle: (key: string) => void;
}) {
  const { manual, children } = node;
  const key = manualKey(manual.id);
  const isExpanded = expanded.has(key);
  const isActive = activeId === manual.id;
  const contentId = `${baseId}-manual-${encodeURIComponent(manual.id)}`;
  const indent = Math.min(depth, 6) * 12;

  return (
    <li>
      <div className="flex min-w-0 items-center" style={{ paddingInlineStart: indent }}>
        <button
          type="button"
          data-testid="guide-menu-item"
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onOpen(manual.id)}
          className={`flex min-h-9 min-w-0 flex-1 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-sm outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
            isActive
              ? 'bg-slate-200 font-semibold text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200'
          }`}
        >
          {manual.icon && (
            <i className={`${manual.icon} shrink-0 text-slate-400`} aria-hidden="true" />
          )}
          <span className="truncate">{manual.title}</span>
        </button>

        {children.length > 0 && (
          <button
            type="button"
            aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} ${manual.title}`}
            aria-controls={contentId}
            aria-expanded={isExpanded}
            onClick={() => onToggle(key)}
            className="ml-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:bg-slate-200"
          >
            <ChevronRight
              size={14}
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {children.length > 0 && isExpanded && (
        <ul id={contentId} className="space-y-0.5">
          {children.map((child) => (
            <ManualBranch
              key={child.manual.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              expanded={expanded}
              baseId={baseId}
              onOpen={onOpen}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function buildMenuTree(items: GuideManual[]): MenuTree {
  const uniqueItems: GuideManual[] = [];
  const seenIds = new Set<string>();
  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    uniqueItems.push(item);
  }

  const categoryItems = new Map<string, { name: string; items: GuideManual[] }>();
  for (const item of uniqueItems) {
    const category = categoryItems.get(item.categoryId) ?? { name: item.categoryName, items: [] };
    category.items.push(item);
    categoryItems.set(item.categoryId, category);
  }

  const categories: CategoryNode[] = [];
  const categoryByManual = new Map<string, string>();
  const parentByManual = new Map<string, string>();

  for (const [categoryId, category] of categoryItems) {
    const byId = new Map(category.items.map((item) => [item.id, item]));
    const candidateParents = new Map<string, string>();

    for (const item of category.items) {
      categoryByManual.set(item.id, categoryId);
      if (item.parentId && item.parentId !== item.id && byId.has(item.parentId)) {
        candidateParents.set(item.id, item.parentId);
      }
    }

    const cycleMembers = findCycleMembers(category.items, candidateParents);
    const nodesById = new Map<string, ManualNode>(
      category.items.map((manual) => [manual.id, { manual, children: [] }]),
    );
    const roots: ManualNode[] = [];

    for (const item of category.items) {
      const parentId = cycleMembers.has(item.id) ? undefined : candidateParents.get(item.id);
      const node = nodesById.get(item.id)!;
      const parent = parentId ? nodesById.get(parentId) : undefined;

      if (parent) {
        parent.children.push(node);
        parentByManual.set(item.id, parentId!);
      } else {
        roots.push(node);
      }
    }

    categories.push({ id: categoryId, name: category.name, nodes: roots });
  }

  return { categories, categoryByManual, parentByManual };
}

function findCycleMembers(items: GuideManual[], parents: Map<string, string>): Set<string> {
  const cycleMembers = new Set<string>();
  const resolved = new Set<string>();

  for (const item of items) {
    if (resolved.has(item.id)) continue;

    const chain: string[] = [];
    const position = new Map<string, number>();
    let currentId: string | undefined = item.id;

    while (currentId && !resolved.has(currentId)) {
      const repeatedAt = position.get(currentId);
      if (repeatedAt !== undefined) {
        for (const id of chain.slice(repeatedAt)) cycleMembers.add(id);
        break;
      }

      position.set(currentId, chain.length);
      chain.push(currentId);
      currentId = parents.get(currentId);
    }

    for (const id of chain) resolved.add(id);
  }

  return cycleMembers;
}

function defaultExpandedKeys(tree: MenuTree): Set<string> {
  const keys = new Set<string>();

  for (const category of tree.categories) {
    keys.add(categoryKey(category.id));
  }

  return keys;
}
