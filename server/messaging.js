const express = require('express');

// Match the existing multi-sponsor and legacy active-sponsor relationship rules.
const membership = (driver, sponsorUser) => `EXISTS (
  SELECT 1 FROM SponsorUsers su WHERE su.user_id = ${sponsorUser} AND (
    EXISTS (SELECT 1 FROM DriverSponsorships ds WHERE ds.driver_id = ${driver} AND ds.sponsor_id = su.sponsor_id)
    OR EXISTS (SELECT 1 FROM Drivers d WHERE d.user_id = ${driver} AND d.sponsor_id = su.sponsor_id)))`;

async function contacts(db, userId, role) {
  let condition, args;
  if (role === 'Admin') { condition = "u.role IN ('Driver', 'Sponsor')"; args = [userId]; }
  else if (role === 'Sponsor') { condition = `u.role = 'Driver' AND ${membership('u.user_id', '?')}`; args = [userId, userId]; }
  else { condition = `u.role = 'Sponsor' AND ${membership('?', 'u.user_id')}`; args = [userId, userId]; }
  const [rows] = await db.query(`SELECT u.user_id, u.name, u.username, u.role, s.company_name
    FROM Users u LEFT JOIN SponsorUsers su ON su.user_id = u.user_id
    LEFT JOIN Sponsors s ON s.sponsor_id = su.sponsor_id
    WHERE u.user_id <> ? AND ${condition} ORDER BY u.name, u.user_id`, args);
  return rows;
}

function createMessagingRouter(pool) {
  const router = express.Router();
  const clean = v => typeof v === 'string' ? v.trim() : '';
  const access = req => [req.userId, req.userRole, req.userId, req.userRole];
  const allowed = '((c.sender_id = ? AND c.sender_role = ?) OR (c.recipient_id = ? AND c.recipient_role = ?))';
  router.use((req, res, next) => {
    if (!['Driver','Sponsor','Admin'].includes(req.userRole)) return res.status(403).json({ message: 'Messaging access required.' });
    next();
  });
  router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return res.status(400).json({ message: 'Invalid conversation.' });
    next();
  });
  async function notify(db, recipientId, authorRole, recipientRole, id) {
    const message = `You have a new message in conversation #${id}. Open Messages to read it.`;
    if (authorRole === 'Sponsor' && recipientRole === 'Driver') {
      await db.query(`INSERT INTO UserAlerts (user_id, alert_type, message)
        SELECT u.user_id, 'message', ? FROM Users u
        LEFT JOIN MessageNotificationPreferences p ON p.user_id = u.user_id
        WHERE u.user_id = ? AND COALESCE(p.sponsor_messages_enabled, 1) = 1`, [message, recipientId]);
    } else await db.query("INSERT INTO UserAlerts (user_id, alert_type, message) VALUES (?, 'message', ?)", [recipientId, message]);
  }
  router.get('/contacts', async (req, res) => {
    try { res.json(await contacts(pool, req.userId, req.userRole)); }
    catch { res.status(500).json({ message: 'Unable to load message recipients.' }); }
  });
  router.get('/preferences', async (req, res) => {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required.' });
    try {
      const [[row]] = await pool.query('SELECT sponsor_messages_enabled FROM MessageNotificationPreferences WHERE user_id = ?', [req.userId]);
      res.json({ sponsorMessagesEnabled: row ? Boolean(row.sponsor_messages_enabled) : true });
    } catch { res.status(500).json({ message: 'Unable to load notification preference.' }); }
  });
  router.put('/preferences', async (req, res) => {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required.' });
    if (typeof req.body?.sponsorMessagesEnabled !== 'boolean') return res.status(400).json({ message: 'Choose a notification preference.' });
    try {
      await pool.query('INSERT INTO MessageNotificationPreferences (user_id, sponsor_messages_enabled) VALUES (?, ?) ON DUPLICATE KEY UPDATE sponsor_messages_enabled = VALUES(sponsor_messages_enabled)', [req.userId, req.body.sponsorMessagesEnabled]);
      res.json({ sponsorMessagesEnabled: req.body.sponsorMessagesEnabled });
    } catch { res.status(500).json({ message: 'Unable to save notification preference.' }); }
  });
  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(`SELECT c.*, a.name AS sender_name, b.name AS recipient_name
        FROM MessageConversations c JOIN Users a ON a.user_id = c.sender_id
        JOIN Users b ON b.user_id = c.recipient_id WHERE ${allowed}
        ORDER BY c.updated_at DESC, c.conversation_id DESC`, access(req));
      res.json(rows);
    } catch { res.status(500).json({ message: 'Unable to load conversations.' }); }
  });
  router.post('/', async (req, res) => {
    const subject = clean(req.body?.subject), message = clean(req.body?.message), ids = req.body?.recipientIds;
    const replies = req.body?.driverRepliesEnabled ?? true;
    if (!subject || subject.length > 160 || !message || message.length > 4000 || !Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length || typeof replies !== 'boolean')
      return res.status(400).json({ message: 'Choose 1–100 recipients, a subject (up to 160 characters), and a message (up to 4000 characters).' });
    if (req.userRole !== 'Sponsor' && (!replies || ids.length !== 1)) return res.status(400).json({ message: 'Choose one recipient. Only sponsors can send to several drivers or disable driver replies.' });
    let db;
    try {
      db = await pool.getConnection(); await db.beginTransaction();
      const eligible = await contacts(db, req.userId, req.userRole);
      const recipients = ids.map(id => eligible.find(u => u.user_id === id));
      if (recipients.some(u => !u)) { await db.rollback(); return res.status(403).json({ message: 'One or more recipients are not available to you. Reload the recipient list.' }); }
      const conversationIds = [];
      for (const recipient of recipients) {
        const [result] = await db.query('INSERT INTO MessageConversations (sender_id, recipient_id, sender_role, recipient_role, subject, driver_replies_enabled) VALUES (?, ?, ?, ?, ?, ?)', [req.userId, recipient.user_id, req.userRole, recipient.role, subject, replies]);
        await db.query('INSERT INTO ConversationMessages (conversation_id, author_id, message) VALUES (?, ?, ?)', [result.insertId, req.userId, message]);
        await notify(db, recipient.user_id, req.userRole, recipient.role, result.insertId);
        conversationIds.push(result.insertId);
      }
      await db.commit(); res.status(201).json({ conversationIds, message: `Message sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.` });
    } catch { if (db) await db.rollback(); res.status(500).json({ message: 'Unable to send message.' }); }
    finally { if (db) db.release(); }
  });
  router.get('/:id/messages', async (req, res) => {
    try {
      const [[conversation]] = await pool.query(`SELECT c.* FROM MessageConversations c WHERE c.conversation_id = ? AND ${allowed}`, [req.params.id, ...access(req)]);
      if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
      const [messages] = await pool.query(`SELECT m.message_id, m.author_id, m.message, m.created_at, u.name AS author_name
        FROM ConversationMessages m JOIN Users u ON u.user_id = m.author_id WHERE m.conversation_id = ? ORDER BY m.message_id`, [req.params.id]);
      res.json({ conversation, messages });
    } catch { res.status(500).json({ message: 'Unable to load messages.' }); }
  });
  router.post('/:id/messages', async (req, res) => {
    const message = clean(req.body?.message);
    if (!message || message.length > 4000) return res.status(400).json({ message: 'Enter a message of up to 4000 characters.' });
    let db;
    try {
      db = await pool.getConnection(); await db.beginTransaction();
      const [[c]] = await db.query(`SELECT c.* FROM MessageConversations c WHERE c.conversation_id = ? AND ${allowed} FOR UPDATE`, [req.params.id, ...access(req)]);
      if (!c) { await db.rollback(); return res.status(404).json({ message: 'Conversation not found.' }); }
      if (req.userRole === 'Driver' && !c.driver_replies_enabled) { await db.rollback(); return res.status(403).json({ message: 'The sponsor has disabled driver replies for this conversation.' }); }
      const otherId = c.sender_id === req.userId ? c.recipient_id : c.sender_id;
      const otherRole = c.sender_id === req.userId ? c.recipient_role : c.sender_role;
      // Existing administrator conversations allow the recipient to reply. Sponsor conversations
      // retain readable history, but sending requires an active sponsorship relationship.
      if (c.sender_role !== 'Admin' && c.recipient_role !== 'Admin') {
        const eligible = await contacts(db, req.userId, req.userRole);
        if (!eligible.some(u => u.user_id === otherId)) { await db.rollback(); return res.status(403).json({ message: 'This sponsorship is no longer active. You can still read previous messages.' }); }
      }
      await db.query('INSERT INTO ConversationMessages (conversation_id, author_id, message) VALUES (?, ?, ?)', [c.conversation_id, req.userId, message]);
      await db.query('UPDATE MessageConversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?', [c.conversation_id]);
      await notify(db, otherId, req.userRole, otherRole, c.conversation_id);
      await db.commit(); res.status(201).json({ message: 'Message sent.' });
    } catch { if (db) await db.rollback(); res.status(500).json({ message: 'Unable to send message.' }); }
    finally { if (db) db.release(); }
  });
  router.patch('/:id/replies', async (req, res) => {
    if (req.userRole !== 'Sponsor') return res.status(403).json({ message: 'Sponsor access required.' });
    if (typeof req.body?.driverRepliesEnabled !== 'boolean') return res.status(400).json({ message: 'Choose whether drivers can reply.' });
    try {
      const [result] = await pool.query(`UPDATE MessageConversations c SET driver_replies_enabled = ?
        WHERE c.conversation_id = ? AND ${allowed} AND (c.sender_role = 'Driver' OR c.recipient_role = 'Driver')`, [req.body.driverRepliesEnabled, req.params.id, ...access(req)]);
      if (!result.affectedRows) return res.status(404).json({ message: 'Conversation not found.' });
      res.json({ driverRepliesEnabled: req.body.driverRepliesEnabled });
    } catch { res.status(500).json({ message: 'Unable to update reply setting.' }); }
  });
  return router;
}
module.exports = { createMessagingRouter };
