/**
 * VirtualizedList — Generic virtualized list wrapper using react-virtuoso.
 *
 * Falls back to regular .map() rendering when the list is shorter than
 * VIRTUALIZATION_THRESHOLD items (no point virtualizing tiny lists).
 * Gracefully degrades if react-virtuoso fails to load.
 */
import { type ReactNode, useCallback, useMemo } from 'react';

// Dynamic import with graceful fallback
let VirtuosoModule: typeof import('react-virtuoso') | null = null;
let virtuosoLoadFailed = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  VirtuosoModule = require('react-virtuoso');
} catch {
  virtuosoLoadFailed = true;
}

/** Below this count, we render items normally (no virtualization overhead). */
export const VIRTUALIZATION_THRESHOLD = 20;

export interface VirtualizedListProps<T> {
  /** The data array to render. */
  items: T[];
  /** Render callback for each item. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Fixed item height in px, or 'auto' for variable-height items. Default 48. */
  itemHeight?: number | 'auto';
  /** Number of extra items to render above/below the viewport. Default 4. */
  overscan?: number;
  /** Additional CSS class name for the list container. */
  className?: string;
  /** Message to display when items is empty. */
  emptyMessage?: string;
  /** Style applied to the outer container. */
  style?: React.CSSProperties;
}

/**
 * Generic virtualized list component.
 *
 * - If `items.length < VIRTUALIZATION_THRESHOLD`, renders normally with `.map()`.
 * - If react-virtuoso is unavailable, falls back to `.map()`.
 * - Otherwise uses `<Virtuoso>` for efficient rendering of large lists.
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 48,
  overscan = 4,
  className,
  emptyMessage = 'No items',
  style,
}: VirtualizedListProps<T>) {
  // Short lists: no virtualization needed
  if (items.length < VIRTUALIZATION_THRESHOLD) {
    if (items.length === 0) {
      return <div className={className} style={style}><p className="fin-empty-small">{emptyMessage}</p></div>;
    }
    return (
      <div className={className} style={style}>
        {items.map((item, idx) => renderItem(item, idx))}
      </div>
    );
  }

  // Fallback if react-virtuoso is unavailable
  if (virtuosoLoadFailed || !VirtuosoModule) {
    return (
      <div className={className} style={{ ...style, overflowY: 'auto', maxHeight: '60vh' }}>
        {items.map((item, idx) => renderItem(item, idx))}
      </div>
    );
  }

  const { Virtuoso } = VirtuosoModule;

  return (
    <Virtuoso
      data={items}
      overscan={overscan}
      defaultItemHeight={itemHeight === 'auto' ? 48 : itemHeight}
      className={className}
      itemContent={(index, item) => renderItem(item, index)}
      style={{ ...style, overflowY: 'auto' }}
    />
  );
}

/**
 * GroupedVirtualizedList — renders items in named groups (e.g., dates).
 *
 * Each group has a fixed header and a list of items. When the total item
 * count across all groups is < VIRTUALIZATION_THRESHOLD, we render normally.
 */
export interface GroupedVirtualizedListProps<T> {
  /** The groups to render. */
  groups: Array<{ key: string; header: ReactNode; items: T[] }>;
  /** Render callback for each item. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Fixed item height in px, or 'auto' for variable-height items. Default 48. */
  itemHeight?: number | 'auto';
  /** Group header height in px. Default 36. */
  groupHeaderHeight?: number;
  /** Number of extra items to render above/below viewport. Default 4. */
  overscan?: number;
  /** Additional CSS class name for the outer container. */
  className?: string;
  /** Message to display when there are no groups/items. */
  emptyMessage?: string;
  /** Style applied to the outer container. */
  style?: React.CSSProperties;
}

export function GroupedVirtualizedList<T>({
  groups,
  renderItem,
  itemHeight = 48,
  groupHeaderHeight = 36,
  overscan = 4,
  className,
  emptyMessage = 'No items',
  style,
}: GroupedVirtualizedListProps<T>) {
  const totalItemCount = useMemo(() => groups.reduce((sum, g) => sum + g.items.length, 0), [groups]);

  // Short lists: no virtualization needed
  if (totalItemCount < VIRTUALIZATION_THRESHOLD) {
    if (totalItemCount === 0) {
      return <div className={className} style={style}><p className="fin-empty-small">{emptyMessage}</p></div>;
    }
    return (
      <div className={className} style={style}>
        {groups.map((group) => (
          <div key={group.key} className="fin-tx-date-group">
            {group.header}
            {group.items.map((item, idx) => renderItem(item, idx))}
          </div>
        ))}
      </div>
    );
  }

  // Fallback if react-virtuoso is unavailable
  if (virtuosoLoadFailed || !VirtuosoModule) {
    return (
      <div className={className} style={{ ...style, overflowY: 'auto', maxHeight: '60vh' }}>
        {groups.map((group) => (
          <div key={group.key} className="fin-tx-date-group">
            {group.header}
            {group.items.map((item, idx) => renderItem(item, idx))}
          </div>
        ))}
      </div>
    );
  }

  const { GroupedVirtuoso } = VirtuosoModule;

  // Flatten items and compute group counts
  const flatItems: T[] = [];
  const groupCounts: number[] = [];
  const groupHeaders: ReactNode[] = [];

  for (const group of groups) {
    groupCounts.push(group.items.length);
    groupHeaders.push(group.header);
    for (const item of group.items) {
      flatItems.push(item);
    }
  }

  return (
    <GroupedVirtuoso
      groupCounts={groupCounts}
      overscan={overscan}
      defaultItemHeight={itemHeight === 'auto' ? 48 : itemHeight}
      groupContent={(index) => groupHeaders[index]}
      itemContent={(index) => {
        const item = flatItems[index];
        return renderItem(item, index);
      }}
      className={className}
      style={{ ...style, overflowY: 'auto' }}
    />
  );
}

export default VirtualizedList;