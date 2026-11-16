import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './driverdashboard.css';
import './admindashboard.css';
import './PointDisputes.css';
import './Support.css';
import './Messages.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');
export default function Messages() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('conversation');
  const [session, setSession] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [detail, setDetail] = useState(null);
  const [recipientIds, setRecipientIds] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [allowReplies, setAllowReplies] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [composing, setComposing] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const messageList = useRef(null);
  const nearBottom = useRef(true);
  const role = session?.role;
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}/api/messaging${path}`, { ...options, headers: {
      Authorization: `Bearer ${sessionStorage.getItem('authToken')}`, 'Content-Type': 'application/json',
    } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Messaging request failed.');
    return data;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${API}/api/session`, { signal: controller.signal, headers: { Authorization: `Bearer ${sessionStorage.getItem('authToken')}` } });
        const current = await response.json();
        if (!response.ok) throw new Error(current.message || 'Please log in to use messages.');
        const people = await request('/contacts', { signal: controller.signal });
        const preference = current.role === 'Driver' ? await request('/preferences', { signal: controller.signal }) : null;
        if (controller.signal.aborted) return;
        setSession(current); setContacts(people);
        if (preference) setNotifications(preference.sponsorMessagesEnabled);
      } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [request]);
  // Poll serially, cancel obsolete selection requests, and preserve unsent drafts.
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let timer;
    async function sync() {
      try {
        const [list, nextDetail] = await Promise.all([
          request('', { signal: controller.signal }),
          selected ? request(`/${selected}/messages`, { signal: controller.signal }) : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        setConversations(list); setDetail(nextDetail); setSyncError('');
      } catch (e) { if (e.name !== 'AbortError') setSyncError(e.message); }
      finally { if (!controller.signal.aborted) timer = setTimeout(sync, 10000); }
    }
    sync();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [request, session, selected, revision]);
  useEffect(() => { setDetail(null); setReply(''); }, [selected]);
  async function action(fn) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setRevision(v => v + 1); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const c = detail?.conversation;
  const back = role === 'Admin' ? '/admin-dashboard' : role === 'Sponsor' ? '/sponsor-dashboard' : '/driver-dashboard';
  const sponsorConversation = c && (c.sender_role === 'Sponsor' || c.recipient_role === 'Sponsor') && (c.sender_role === 'Driver' || c.recipient_role === 'Driver');
  const otherId = c && (c.sender_id === session?.userId ? c.recipient_id : c.sender_id);
  const inactive = sponsorConversation && !contacts.some(person => person.user_id === otherId);
  const blocked = role === 'Driver' && c && !c.driver_replies_enabled;
  const currentSummary = conversations.find(item => String(item.conversation_id) === selected);
  const counterpart = item => item.sender_id === session?.userId ? item.recipient_name : item.sender_name;
  const contactName = currentSummary ? counterpart(currentSummary) : contacts.find(person => person.user_id === otherId)?.name || 'Conversation';
  const initials = name => (name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const matchingContacts = contacts.filter(person => [person.name, person.username, person.company_name, person.role].some(value => String(value || '').toLowerCase().includes(recipientSearch.trim().toLowerCase())));
  const matchingConversations = conversations.filter(item => [item.subject, counterpart(item)].some(value => String(value || '').toLowerCase().includes(conversationSearch.trim().toLowerCase())));
  const lastMessageId = detail?.messages.at(-1)?.message_id;
  useEffect(() => { nearBottom.current = true; }, [selected, composing]);
  useEffect(() => {
    const element = messageList.current;
    if (element && nearBottom.current) element.scrollTop = element.scrollHeight;
  }, [lastMessageId, selected, composing]);
  return <main className="dashboard-page messages-page"><div className="messenger-container">
    <header className="dashboard-topbar messenger-topbar"><div><p className="dashboard-eyebrow">Stay connected</p><h1 className="dashboard-greeting">Messages</h1>
      <p className="dashboard-section-description">Your drivers, sponsors, and administrators — one conversation away.</p></div>
      <Link className="disputes-back" to={back}>← Back to dashboard</Link></header>
    {error && <p role="alert" className="disputes-error">{error}</p>}
    {syncError && <p role="alert" className="disputes-error">{syncError} Use Refresh to try again.</p>}
    {notice && <p role="status" className="messenger-notice">{notice}</p>}
    {loading ? <p role="status">Loading messages…</p> : session && <>
      <div className="messenger-utilities"><span className="messenger-sync">Updates automatically</span><div>
        {role === 'Driver' && <details className="messenger-preferences"><summary>Notification settings</summary><div>
          <label className="messages-check"><input type="checkbox" checked={notifications} disabled={busy} onChange={e => { const enabled = e.target.checked; action(async () => {
            const result = await request('/preferences', { method: 'PUT', body: JSON.stringify({ sponsorMessagesEnabled: enabled }) });
            setNotifications(result.sponsorMessagesEnabled); setNotice(enabled ? 'Sponsor message notifications enabled.' : 'Sponsor message notifications disabled.');
          }); }} />Notify me when sponsors send messages or replies</label><small>Support and administrator alerts are unaffected.</small>
        </div></details>}
        <Link to="/support">Contact support ↗</Link>
      </div></div>
      <div className={`messenger-shell ${selected || composing ? 'messenger-active' : ''}`}>
        <aside className="messenger-sidebar" aria-label="Conversation inbox">
          <div className="messenger-sidebar-heading"><h2>Inbox <span>{conversations.length}</span></h2><button className="messenger-refresh" disabled={busy} aria-label="Refresh" title="Refresh messages" onClick={() => setRevision(v => v + 1)}>↻</button></div>
          <button className="messenger-primary messenger-new" disabled={busy} onClick={() => { setComposing(true); setParams({}); setError(''); setNotice(''); }}>＋ New message</button>
          <div className="messenger-search"><label className="messenger-sr-only" htmlFor="conversation-search">Search conversations</label><span aria-hidden="true">⌕</span><input id="conversation-search" type="search" placeholder="Search conversations" value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} /></div>
          <nav className="messenger-conversations" aria-label="Conversations">
            {matchingConversations.length ? matchingConversations.map(item => <button key={item.conversation_id} className={`messenger-conversation ${!composing && String(item.conversation_id) === selected ? 'is-selected' : ''}`} aria-label={`${item.subject} — ${counterpart(item)}`} aria-pressed={!composing && String(item.conversation_id) === selected} disabled={busy} onClick={() => { setComposing(false); setParams({ conversation: String(item.conversation_id) }); nearBottom.current = true; }}>
              <span className="messenger-avatar" aria-hidden="true">{initials(counterpart(item))}</span><span className="messenger-conversation-text"><span className="messenger-conversation-name">{counterpart(item)}</span><span className="messenger-conversation-subject">{item.subject}</span><time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></span>
            </button>) : <div className="messenger-list-empty"><strong>{conversationSearch ? 'No matching conversations' : 'Your inbox is empty'}</strong><p>{conversationSearch ? 'Try a different name or subject.' : 'Start a new message to connect with someone.'}</p></div>}
          </nav>
        </aside>
        <section className="messenger-main" aria-label={composing ? 'Compose message' : 'Conversation'}>
          <button className="messenger-mobile-back" disabled={busy} onClick={() => { setComposing(false); setParams({}); }}>← Inbox</button>
          {composing ? <>
            <header className="messenger-chat-header"><div><p className="dashboard-eyebrow">Start a conversation</p><h2>New message</h2></div><button className="messenger-quiet" disabled={busy} onClick={() => setComposing(false)}>Cancel</button></header>
            <form className="messenger-compose" onSubmit={e => { e.preventDefault(); action(async () => {
              const result = await request('', { method: 'POST', body: JSON.stringify({ recipientIds, subject, message, driverRepliesEnabled: role === 'Sponsor' ? allowReplies : true }) });
              setSubject(''); setMessage(''); setRecipientIds([]); setRecipientSearch(''); setNotice(result.message); setComposing(false);
              setParams({ conversation: String(result.conversationIds[0]) });
            }); }}>
              <label htmlFor="recipient-search">To {role === 'Sponsor' && <small>· Choose up to 100 drivers</small>}</label>
              <div className="messenger-search"><span aria-hidden="true">⌕</span><input autoFocus aria-label="Search recipients" id="recipient-search" type="search" placeholder="Search by name, email, or organization" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} /></div>
              {!!recipientIds.length && <div className="messenger-chips" aria-label="Selected recipients">{recipientIds.map(id => <span key={id}>{contacts.find(person => person.user_id === id)?.name}<button type="button" aria-label={`Remove ${contacts.find(person => person.user_id === id)?.name}`} onClick={() => setRecipientIds(ids => ids.filter(value => value !== id))}>×</button></span>)}</div>}
              <fieldset className="messenger-recipient-results"><legend className="messenger-sr-only">Recipients</legend>
                {matchingContacts.length ? matchingContacts.map(person => <label className={`messenger-person ${recipientIds.includes(person.user_id) ? 'is-selected' : ''}`} key={person.user_id}>
                  <input type={role === 'Sponsor' ? 'checkbox' : 'radio'} name="recipient" aria-label={`${person.name} — ${person.company_name || person.role} (${person.username})`} checked={recipientIds.includes(person.user_id)} disabled={role === 'Sponsor' && recipientIds.length >= 100 && !recipientIds.includes(person.user_id)} onChange={e => setRecipientIds(role === 'Sponsor' ? (e.target.checked ? [...recipientIds, person.user_id] : recipientIds.filter(id => id !== person.user_id)) : [person.user_id])} />
                  <span className="messenger-avatar" aria-hidden="true">{initials(person.name)}</span><span className="messenger-person-text"><strong>{person.name}</strong><small>{person.username}</small></span><span className="messenger-role">{person.company_name || person.role}</span>
                </label>) : <p className="messenger-list-empty">{contacts.length ? 'No people found. Try another name, email, or organization.' : 'No recipients are currently available.'}</p>}
              </fieldset>
              {role === 'Sponsor' && <p className="messenger-hint">Each driver receives a private conversation. Replies are only visible to you and that driver.</p>}
              <label htmlFor="message-subject">Subject</label><input id="message-subject" placeholder="What would you like to discuss?" required maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} />
              <label htmlFor="message-body">Message</label><textarea id="message-body" placeholder="Write your message…" required maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} />
              <div className="messenger-compose-footer">{role === 'Sponsor' && <label className="messages-check"><input type="checkbox" checked={allowReplies} onChange={e => setAllowReplies(e.target.checked)} />Allow drivers to reply</label>}<button className="messenger-primary" disabled={busy || !recipientIds.length || recipientIds.length > 100 || !subject.trim() || !message.trim()}>Send new message <span aria-hidden="true">↗</span></button></div>
            </form>
          </> : c ? <>
            <header className="messenger-chat-header"><span className="messenger-avatar" aria-hidden="true">{initials(contactName)}</span><div className="messenger-chat-heading"><h2>{contactName}</h2><p>{c.subject}</p></div></header>
            {role === 'Sponsor' && sponsorConversation && <div className="messenger-reply-setting"><label className="messages-check"><input type="checkbox" disabled={busy} checked={Boolean(c.driver_replies_enabled)} onChange={e => { const enabled = e.target.checked; action(async () => {
              await request(`/${selected}/replies`, { method: 'PATCH', body: JSON.stringify({ driverRepliesEnabled: enabled }) });
              setNotice(enabled ? 'Driver replies enabled.' : 'Driver replies disabled.');
            }); }} />Allow driver replies in this conversation</label></div>}
            <ol className="messenger-history" ref={messageList} aria-label="Message history" onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
              {detail.messages.map(m => <li key={m.message_id} className={`messenger-message ${m.author_id === session.userId ? 'is-mine' : ''}`}><div className="messenger-bubble"><strong>{m.author_id === session.userId ? 'You' : m.author_name}</strong><p>{m.message}</p></div><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></li>)}
            </ol>
            {inactive ? <p className="messenger-locked">This sponsorship is no longer active. Previous messages remain available.</p> : blocked ? <p className="messenger-locked">The sponsor has disabled replies for this conversation.</p> : <form className="messenger-reply" onSubmit={e => { e.preventDefault(); action(async () => {
              await request(`/${selected}/messages`, { method: 'POST', body: JSON.stringify({ message: reply }) });
              nearBottom.current = true; setReply(''); setNotice('Reply sent.');
            }); }}><label className="messenger-sr-only" htmlFor="message-reply">Reply</label><textarea id="message-reply" placeholder="Write a reply…" maxLength={4000} required value={reply} onChange={e => setReply(e.target.value)} /><div><small>{reply.length}/4000</small><button className="messenger-primary" disabled={busy || !reply.trim()}>Send reply <span aria-hidden="true">↗</span></button></div></form>}
          </> : selected ? <div className="messenger-empty"><p role="status">{syncError ? 'This conversation could not be loaded.' : 'Loading conversation…'}</p></div> : <div className="messenger-empty"><span className="messenger-empty-icon" aria-hidden="true">✉</span><h2>A conversation starts here</h2><p>Select a conversation from your inbox, or find someone to message.</p><button className="messenger-primary" onClick={() => setComposing(true)}>Start a conversation</button></div>}
        </section>
      </div>
    </>}
  </div></main>;
}
