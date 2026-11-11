import { useId, useState } from 'react';
import './SmartTable.css';

export default function SmartList({ items, label, options, children }) {
  const id = useId();
  const [sort, setSort] = useState('original');
  const [expanded, setExpanded] = useState(false);
  const [key, direction] = sort.split(':');
  const sorted = [...items];
  const option = options.find((item) => item.key === key);
  if (option) sorted.sort((a, b) => {
    const av = option.value(a), bv = option.value(b);
    if (av == null || av === '') return bv == null || bv === '' ? 0 : 1;
    if (bv == null || bv === '') return -1;
    const result = option.type === 'date' ? (Date.parse(av) || 0) - (Date.parse(bv) || 0)
      : option.type === 'number' ? Number(av) - Number(bv)
      : String(av).localeCompare(String(bv), undefined, { numeric:true, sensitivity:'base' });
    return direction === 'desc' ? -result : result;
  });
  const visible = expanded ? sorted : sorted.slice(0, 10);
  return <div className="smart-list">
    <div className="smart-list-toolbar"><label htmlFor={id}>Sort {label}</label><select id={id} value={sort} onChange={event => { setSort(event.target.value); setExpanded(false); }}>
      <option value="original">Default order</option>
      {options.flatMap(option => [<option key={`${option.key}:asc`} value={`${option.key}:asc`}>{option.label} {option.type === 'date' ? '(oldest first)' : option.type === 'number' ? '(low to high)' : '(A–Z)'}</option>, <option key={`${option.key}:desc`} value={`${option.key}:desc`}>{option.label} {option.type === 'date' ? '(newest first)' : option.type === 'number' ? '(high to low)' : '(Z–A)'}</option>])}
    </select></div>
    {children(visible)}
    {sorted.length > 10 && <div className="smart-list-footer"><span>Showing {visible.length} of {sorted.length}</span><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'Show more'}</button></div>}
  </div>;
}
