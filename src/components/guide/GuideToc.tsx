import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './guide-widgets.css';

export type GuideHeading = { id: string; text: string; level: number };

const DESKTOP_TOC_QUERY = '(min-width: 80rem)';

function isDesktopToc() {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_TOC_QUERY).matches;
}

function currentHash() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return '';
  }
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function GuideToc({ toc, contentKey, onSelect }: {
  toc: GuideHeading[];
  contentKey: string;
  onSelect?: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState('');
  const [expanded, setExpanded] = useState(isDesktopToc);
  const handlesNavigation = !!onSelect;

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_TOC_QUERY);
    const handleBreakpoint = (event: MediaQueryListEvent) => setExpanded(event.matches);
    setExpanded(media.matches);
    media.addEventListener('change', handleBreakpoint);
    return () => media.removeEventListener('change', handleBreakpoint);
  }, []);

  useEffect(() => {
    if (!isDesktopToc()) setExpanded(false);
  }, [contentKey]);

  useEffect(() => {
    const root = document.getElementById('guide-scroll');
    const headings = toc
      .map(item => document.getElementById(item.id))
      .filter((node): node is HTMLElement => !!node);
    if (!root || !headings.length) {
      setActiveId('');
      return;
    }

    const updateActiveHeading = () => {
      const activationLine = root.getBoundingClientRect().top + 96;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= activationLine) current = heading;
        else break;
      }
      setActiveId(current.id);
    };

    let frame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveHeading);
    };
    const observer = new IntersectionObserver(scheduleUpdate, {
      root,
      threshold: [0, 1],
      rootMargin: '-96px 0px -65% 0px',
    });
    headings.forEach(heading => observer.observe(heading));
    root.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    const hashTarget = handlesNavigation ? undefined : headings.find(heading => heading.id === currentHash());
    if (hashTarget) {
      frame = requestAnimationFrame(() => {
        hashTarget.scrollIntoView({ block: 'start' });
        setActiveId(hashTarget.id);
      });
    } else {
      updateActiveHeading();
    }

    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      cancelAnimationFrame(frame);
    };
  }, [toc, contentKey, handlesNavigation]);

  function selectHeading(id: string) {
    setActiveId(id);
    if (onSelect) {
      onSelect(id);
    } else {
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.replaceState(window.history.state, '', url);
      document.getElementById(id)?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    }
    if (!isDesktopToc()) setExpanded(false);
  }

  if (!toc.length) return null;

  return (
    <aside className="guide-toc" data-testid="guide-toc" aria-label="Índice deste artigo">
      <details open={expanded} onToggle={event => setExpanded(isDesktopToc() || event.currentTarget.open)}>
        <summary>
          <span>Nesta página</span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <nav aria-label="Nesta página">
          {toc.map(heading => (
            <a
              key={heading.id}
              href={`#${encodeURIComponent(heading.id)}`}
              aria-current={activeId === heading.id ? 'location' : undefined}
              className={`guide-toc-level-${heading.level}`}
              onClick={event => {
                event.preventDefault();
                selectHeading(heading.id);
              }}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      </details>
    </aside>
  );
}
