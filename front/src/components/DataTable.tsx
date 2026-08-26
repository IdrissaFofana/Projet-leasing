'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * mul;
  if (b == null) return -1 * mul;
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mul;
  }
  const sa = String(a).toLocaleLowerCase('fr');
  const sb = String(b).toLocaleLowerCase('fr');
  return sa.localeCompare(sb, 'fr') * mul;
}

export function useTableSort<T>(defaultKey: string, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggle = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sort = useCallback(
    (rows: T[], accessor: (row: T, key: string) => unknown) => {
      return [...rows].sort((a, b) => compareValues(accessor(a, sortKey), accessor(b, sortKey), sortDir));
    },
    [sortKey, sortDir],
  );

  return useMemo(
    () => ({ sortKey, sortDir, toggle, sort }),
    [sortKey, sortDir, toggle, sort],
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`sort-icon${active ? ' is-active' : ''}`} aria-hidden>
      <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
        <path
          d="M5 0 9 5H1z"
          className={active && dir === 'asc' ? 'sort-caret-on' : 'sort-caret-off'}
        />
        <path
          d="M5 12 1 7h8z"
          className={active && dir === 'desc' ? 'sort-caret-on' : 'sort-caret-off'}
        />
      </svg>
    </span>
  );
}

export function SortTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
  align,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  direction: SortDir;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const active = activeKey === sortKey;
  return (
    <th className={className} data-align={align}>
      <button
        type="button"
        className={`sort-th${active ? ' is-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <SortIcon active={active} dir={direction} />
      </button>
    </th>
  );
}

export function DataTableShell({
  loading,
  empty,
  emptyMessage = 'Aucune donnee',
  children,
  className,
}: {
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={`table-wrap is-loading${className ? ` ${className}` : ''}`}>
        <div className="table-loading" role="status" aria-live="polite">
          <span className="table-loading-bar" aria-hidden />
          <p>Chargement…</p>
        </div>
      </div>
    );
  }
  if (empty) {
    return (
      <div className={`table-wrap is-empty${className ? ` ${className}` : ''}`}>
        <p className="empty-state">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className={`table-wrap${className ? ` ${className}` : ''}`}>
      <div className="table-scroll">{children}</div>
    </div>
  );
}

export function TableActions({
  onEdit,
  onDelete,
  onView,
  viewHref,
  editLabel = 'Modifier',
  deleteLabel = 'Supprimer',
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  viewHref?: string;
  editLabel?: string;
  deleteLabel?: string;
}) {
  return (
    <div className="tbl-actions">
      {onView ? (
        <button type="button" className="tbl-btn" title="Voir" onClick={onView}>
          <IconEye />
        </button>
      ) : viewHref ? (
        <Link href={viewHref} className="tbl-btn" title="Voir">
          <IconEye />
        </Link>
      ) : null}
      {onEdit ? (
        <button type="button" className="tbl-btn" title={editLabel} onClick={onEdit}>
          <IconEdit />
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className="tbl-btn is-danger" title={deleteLabel} onClick={onDelete}>
          <IconTrash />
        </button>
      ) : null}
    </div>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 14h10l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
