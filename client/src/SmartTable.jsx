import { Children, cloneElement, isValidElement, useMemo, useState } from 'react';
import './SmartTable.css';

function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return isValidElement(node) ? textOf(node.props.children) : '';
}

function compareValues(a, b, heading) {
  const av = a?.props['data-sort-value'] ?? textOf(a);
  const bv = b?.props['data-sort-value'] ?? textOf(b);
  if (!String(av).trim()) return String(bv).trim() ? 1 : 0;
  if (!String(bv).trim()) return -1;
  if (/date|time|updated|created/i.test(heading)) {
    const ad = Date.parse(av), bd = Date.parse(bv);
    if (Number.isFinite(ad) && Number.isFinite(bd)) return ad - bd;
  }
  const an = Number(String(av).replace(/[,\s]/g, '').replace(/\s*(pts|points)\s*$/i, ''));
  const bn = Number(String(bv).replace(/[,\s]/g, '').replace(/\s*(pts|points)\s*$/i, ''));
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
}

export default function SmartTable({ children, ...tableProps }) {
  const [sort, setSort] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const sections = Children.toArray(children);
  const head = sections.find((node) => node.type === 'thead');
  const body = sections.find((node) => node.type === 'tbody');
  const headRow = head && Children.toArray(head.props.children).find(isValidElement);
  const headings = headRow ? Children.toArray(headRow.props.children) : [];
  const rows = body ? Children.toArray(body.props.children).filter(isValidElement) : [];
  const isMessage = rows.length === 1 && Children.toArray(rows[0].props.children).some(cell => cell.props?.colSpan);
  const sorted = useMemo(() => {
    if (!sort || isMessage) return rows;
    return rows.map((row, index) => ({ row, index })).sort((a, b) => {
      const ac = Children.toArray(a.row.props.children)[sort.column];
      const bc = Children.toArray(b.row.props.children)[sort.column];
      const result = compareValues(ac, bc, textOf(headings[sort.column]));
      return (sort.direction === 'asc' ? result : -result) || a.index - b.index;
    }).map(({ row }) => row);
  }, [children, sort]);
  const total = isMessage ? 0 : sorted.length;
  const visible = expanded ? sorted : sorted.slice(0, 10);
  const nextHead = head && cloneElement(head, {}, cloneElement(headRow, {}, headings.map((heading, column) => {
    const label = textOf(heading).trim();
    if (!label || /^(action|actions|select)$/i.test(label)) return heading;
    const active = sort?.column === column;
    return cloneElement(heading, { key: heading.key ?? column, 'aria-sort': active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none' },
      <button className="smart-sort" type="button" onClick={() => { setSort(active && sort.direction === 'asc' ? {column, direction:'desc'} : {column, direction:'asc'}); setExpanded(false); }}>
        {heading.props.children}<span aria-hidden="true">{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span><span className="smart-sr">{active ? (sort.direction === 'asc' ? ', ascending' : ', descending') : ', sortable'}</span>
      </button>);
  })));
  return <>
    <table {...tableProps}>{sections.map((section) => section === head ? nextHead : section === body ? cloneElement(body, {}, isMessage ? rows : visible) : section)}</table>
    {total > 10 && <div className="smart-list-footer"><span>Showing {visible.length} of {total}</span><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'Show more'}</button></div>}
  </>;
}
