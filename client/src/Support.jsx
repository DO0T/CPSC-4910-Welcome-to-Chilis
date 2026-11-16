import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './driverdashboard.css';
import './admindashboard.css';
import './PointDisputes.css';
import './Support.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

export default function Support() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('ticket');
  const [role, setRole] = useState('');
  const [tickets, setTickets] = useState([]);
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState('');
  const [problem, setProblem] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const generation = useRef(0);
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${sessionStorage.getItem('authToken')}`, 'Content-Type': 'application/json' },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Request failed.');
    return body;
  }, []);
  const refresh = useCallback(async () => setTickets(await request('/api/support')), [request]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await request('/api/session');
        if (!active) return;
        setRole(session.role);
        await refresh();
      } catch (e) { if (active) setError(e.message); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [request, refresh]);
  const loadConversation = useCallback(async () => {
    const version = ++generation.current;
    if (!selected) { setMessages([]); return; }
    setConversationLoading(true);
    try {
      const rows = await request(`/api/support/${selected}/messages`);
      if (version === generation.current) setMessages(rows);
    } catch (e) { if (version === generation.current) setError(e.message); }
    finally { if (version === generation.current) setConversationLoading(false); }
  }, [selected, request]);
  useEffect(() => {
    setMessages([]); setReply('');
    loadConversation();
    return () => { generation.current++; };
  }, [loadConversation]);
  async function action(fn) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const current = tickets.find(t => String(t.ticket_id) === selected);
  const back = role === 'Admin' ? '/admin-dashboard' : role === 'Sponsor' ? '/sponsor-dashboard' : '/driver-dashboard';
  return <main className="dashboard-page disputes-page support-page"><div className="disputes-content">
    <header className="dashboard-topbar"><div>
      <p className="dashboard-eyebrow">{role === 'Admin' ? 'System administration' : 'Help center'}</p>
      <h1 className="dashboard-greeting">Support</h1>
      <p className="dashboard-section-description">{role === 'Admin' ? 'Review support requests and respond to users here.' : 'Tell us what went wrong. An administrator will respond here on the website.'}</p>
    </div><Link className="disputes-back" to={back}>← Back to dashboard</Link></header>
    {error && <p role="alert" className="disputes-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading support…</p> : <>
      {['Driver', 'Sponsor'].includes(role) && <section className="dashboard-card disputes-card">
        <header className="dashboard-card-header"><h2>Contact support</h2></header>
        <form className="disputes-card-body" onSubmit={e => { e.preventDefault(); action(async () => {
          const result = await request('/api/support', { method: 'POST', body: JSON.stringify({ subject, message: problem }) });
          setSubject(''); setProblem(''); setNotice(result.message);
          setParams({ ticket: String(result.ticketId) });
          await refresh();
        }); }}>
          <label htmlFor="support-subject">Subject</label><input id="support-subject" required maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} />
          <label htmlFor="support-problem">Describe your problem</label><textarea id="support-problem" required maxLength={4000} value={problem} onChange={e => setProblem(e.target.value)} />
          <p className="dashboard-section-description">You will receive a ticket number. Continue the conversation here after submitting.</p>
          <button disabled={busy || !subject.trim() || !problem.trim()}>{busy ? 'Please wait…' : 'Submit support request'}</button>
        </form>
      </section>}
      <section className="dashboard-card disputes-card"><header className="dashboard-card-header"><h2>{role === 'Admin' ? 'Support tickets' : 'My tickets'}</h2></header>
        <div className="disputes-card-body"><button disabled={busy} onClick={() => action(async () => { await refresh(); await loadConversation(); })}>Refresh</button>
          {tickets.length === 0 ? <p>No support tickets yet.</p> : <ul className="support-tickets">{tickets.map(t => <li key={t.ticket_id}>
            <button disabled={busy} aria-pressed={String(t.ticket_id) === selected} onClick={() => { setError(''); setParams({ ticket: String(t.ticket_id) }); }}>#{t.ticket_id} — {t.subject}</button>
            <span className="dispute-status">{t.status === 'OPEN' ? 'Open' : 'Closed'}</span>
            {role === 'Admin' && <span>{t.requester_name}</span>}
            <small>{new Date(t.updated_at).toLocaleString()}</small>
          </li>)}</ul>}
        </div>
      </section>
      {current && <section className="dashboard-card disputes-card"><header className="dashboard-card-header"><h2>Ticket #{current.ticket_id}: {current.subject}</h2></header>
        <div className="disputes-card-body">
          {role === 'Admin' && (!current.acknowledgement_sent || !current.notification_sent) && <p role="status">One or more ticket emails were not confirmed. The conversation is available here.</p>}
          {conversationLoading ? <p role="status">Loading conversation…</p> : <ol className="disputes-messages">{messages.map(m => <li key={m.message_id}><strong>{m.author_name}</strong> <small>{new Date(m.created_at).toLocaleString()}</small><p className="support-message">{m.message}</p></li>)}</ol>}
          {current.status === 'OPEN' ? <form onSubmit={e => { e.preventDefault(); action(async () => {
            await request(`/api/support/${selected}/messages`, { method: 'POST', body: JSON.stringify({ message: reply }) });
            setReply(''); setNotice('Message sent.'); await loadConversation(); await refresh();
          }); }}><label htmlFor="support-reply">Message</label><textarea id="support-reply" required maxLength={4000} value={reply} onChange={e => setReply(e.target.value)} /><button disabled={busy || conversationLoading || !reply.trim()}>Send message</button></form> : <p>This ticket is closed. You can open a new request if you need more help.</p>}
          {role === 'Admin' && <div className="support-actions"><button disabled={busy} onClick={() => action(async () => {
            await request(`/api/support/${selected}/status`, { method: 'PATCH', body: JSON.stringify({ status: current.status === 'OPEN' ? 'CLOSED' : 'OPEN' }) });
            await refresh();
          })}>{current.status === 'OPEN' ? 'Close ticket' : 'Reopen ticket'}</button></div>}
        </div>
      </section>}
    </>}
  </div></main>;
}
