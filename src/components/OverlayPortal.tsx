import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './OverlayPortal.css';

const TIER_Z: Record<string, number> = {
  drawer: 8000,
  toast: 9000,
  fab: 9500,
  chat: 9800,
  modal: 9900,
  command: 9950,
  celebration: 10000,
};

const ROOT_ID = 'lifeos-overlay-root';

function getOrCreateRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

function getOrCreateTier(root: HTMLElement, tier: string): HTMLElement {
  const id = `overlay-tier-${tier}`;
  let el = root.querySelector(`#${id}`) as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.dataset.overlayTier = tier;
    el.style.cssText = `position:fixed;inset:0;z-index:${TIER_Z[tier] ?? 8000};pointer-events:none;`;
    root.appendChild(el);
  }
  return el;
}

interface OverlayPortalProps {
  tier: keyof typeof TIER_Z;
  children: ReactNode;
}

export function OverlayPortal({ tier, children }: OverlayPortalProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  if (!containerRef.current) {
    const root = getOrCreateRoot();
    containerRef.current = getOrCreateTier(root, tier);
  }

  // Ensure tier element stays in DOM
  useEffect(() => {
    return () => {
      // Don't remove — other portals may share the tier
    };
  }, []);

  return createPortal(children, containerRef.current);
}
