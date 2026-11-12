const express = require('express');
const { createSupportEmailSender } = require('./support-email');

function createSupportRouter(pool, sendEmail = createSupportEmailSender(), env = process.env) {
  const router = express.Router();
  const clean = value => typeof value === 'string' ? value.trim() : '';
  // A sponsor sees only their own support tickets, never their drivers' tickets.
  const access = req => [req.userRole, req.userId];
  const permitted = "(? = 'Admin' OR t.requester_id = ?)";
  router.use((req, res, next) => {
    if (!['Driver', 'Sponsor', 'Admin'].includes(req.userRole))
      return res.status(403).json({ message: 'Driver, sponsor, or administrator access required.' });
    next();
  });
  router.param('id', (req, res, next, value) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
      return res.status(400).json({ message: 'Invalid ticket number.' });
    next();
  });

  async function deliver(ticket) {
    const link = env.FRONTEND_URL
      ? `${env.FRONTEND_URL.replace(/\/$/, '')}/support?ticket=${ticket.ticket_id}`
      : 'Sign in to the website and open Support.';
    for (const kind of ['acknowledgement', 'notification']) {
      if (ticket[`${kind}_sent`]) continue;
      try {
        await sendEmail(kind === 'acknowledgement' ? {
          to: ticket.requester_email,
          subject: `Support ticket #${ticket.ticket_id} received`,
          text: `We received your support request: ${ticket.subject}\n\nYour ticket number is #${ticket.ticket_id}. An administrator will contact you via the on-website messaging system. Please continue this conversation on the website rather than replying to this email.\n\n${link}`,
        } : {
          to: env.SUPPORT_TO_EMAIL || 'welcometochilis6@gmail.com',
          subject: `New support ticket #${ticket.ticket_id}: ${ticket.subject}`,
          text: `A new support request was submitted by ${ticket.requester_name}.\n\n${ticket.opening_message}\n\nReply to ticket #${ticket.ticket_id} on the website:\n${link}`,
        });
        await pool.query(`UPDATE SupportTickets SET ${kind}_sent = TRUE, updated_at = updated_at WHERE ticket_id = ?`, [ticket.ticket_id]);
        ticket[`${kind}_sent`] = true;
      } catch {
        // The saved ticket remains available even if email is unavailable.
        console.warn(`Support ticket ${ticket.ticket_id}: ${kind} email was not confirmed.`);
      }
    }
    return Boolean(ticket.acknowledgement_sent && ticket.notification_sent);
  }

  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(`SELECT t.*, u.name AS requester_name
        FROM SupportTickets t JOIN Users u ON u.user_id = t.requester_id
        WHERE ${permitted} ORDER BY t.updated_at DESC, t.ticket_id DESC`, access(req));
      res.json(rows);
    } catch { res.status(500).json({ message: 'Unable to load support tickets.' }); }
  });

  router.post('/', async (req, res) => {
    if (!['Driver', 'Sponsor'].includes(req.userRole))
      return res.status(403).json({ message: 'Driver or sponsor access required to open a ticket.' });
    const subject = clean(req.body?.subject), message = clean(req.body?.message);
    if (!subject || subject.length > 160 || !message || message.length > 4000)
      return res.status(400).json({ message: 'Enter a subject (up to 160 characters) and a problem description (up to 4000 characters).' });
    let connection, ticket;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[user]] = await connection.query('SELECT name, username FROM Users WHERE user_id = ?', [req.userId]);
      if (!user) throw new Error('Missing user');
      const [result] = await connection.query('INSERT INTO SupportTickets (requester_id, subject) VALUES (?, ?)', [req.userId, subject]);
      await connection.query('INSERT INTO SupportMessages (ticket_id, author_id, message) VALUES (?, ?, ?)', [result.insertId, req.userId, message]);
      await connection.query("INSERT INTO UserAlerts (user_id, alert_type, message) SELECT user_id, 'support', ? FROM Users WHERE role = 'Admin'", [`New support ticket #${result.insertId}. Open Support to respond.`]);
      await connection.commit();
      ticket = { ticket_id: result.insertId, subject, opening_message: message, requester_email: user.username, requester_name: user.name };
    } catch {
      if (connection) await connection.rollback();
      return res.status(500).json({ message: 'Unable to create support ticket.' });
    } finally { if (connection) connection.release(); }
    const emailSent = await deliver(ticket);
    res.status(201).json({ ticketId: ticket.ticket_id, emailSent,
      message: `Ticket #${ticket.ticket_id} created. ${emailSent ? 'An acknowledgement has been sent to your email.' : 'Email delivery could not be confirmed; your ticket is saved and administrators can respond here.'}` });
  });

  router.get('/:id/messages', async (req, res) => {
    try {
      const [tickets] = await pool.query(`SELECT t.ticket_id FROM SupportTickets t WHERE t.ticket_id = ? AND ${permitted}`, [req.params.id, ...access(req)]);
      if (!tickets.length) return res.status(404).json({ message: 'Ticket not found.' });
      const [rows] = await pool.query(`SELECT m.message_id, m.message, m.created_at, u.name AS author_name
        FROM SupportMessages m JOIN Users u ON u.user_id = m.author_id
        WHERE m.ticket_id = ? ORDER BY m.message_id`, [req.params.id]);
      res.json(rows);
    } catch { res.status(500).json({ message: 'Unable to load conversation.' }); }
  });

  router.post('/:id/messages', async (req, res) => {
    const message = clean(req.body?.message);
    if (!message || message.length > 4000) return res.status(400).json({ message: 'Enter a message of up to 4000 characters.' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[ticket]] = await connection.query(`SELECT t.* FROM SupportTickets t WHERE t.ticket_id = ? AND ${permitted} FOR UPDATE`, [req.params.id, ...access(req)]);
      if (!ticket || ticket.status !== 'OPEN') {
        await connection.rollback();
        return res.status(ticket ? 409 : 404).json({ message: ticket ? 'This ticket is closed.' : 'Ticket not found.' });
      }
      await connection.query('INSERT INTO SupportMessages (ticket_id, author_id, message) VALUES (?, ?, ?)', [ticket.ticket_id, req.userId, message]);
      await connection.query('UPDATE SupportTickets SET updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?', [ticket.ticket_id]);
      if (req.userRole === 'Admin')
        await connection.query("INSERT INTO UserAlerts (user_id, alert_type, message) VALUES (?, 'support', ?)", [ticket.requester_id, `An administrator replied to support ticket #${ticket.ticket_id}. Open Support to read it.`]);
      else
        await connection.query("INSERT INTO UserAlerts (user_id, alert_type, message) SELECT user_id, 'support', ? FROM Users WHERE role = 'Admin'", [`A user replied to support ticket #${ticket.ticket_id}. Open Support to read it.`]);
      await connection.commit();
      res.status(201).json({ message: 'Message sent.' });
    } catch {
      if (connection) await connection.rollback();
      res.status(500).json({ message: 'Unable to send message.' });
    } finally { if (connection) connection.release(); }
  });

  router.patch('/:id/status', async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Administrator access required.' });
    if (!['OPEN', 'CLOSED'].includes(req.body?.status)) return res.status(400).json({ message: 'Choose OPEN or CLOSED.' });
    try {
      const [result] = await pool.query('UPDATE SupportTickets SET status = ? WHERE ticket_id = ?', [req.body.status, req.params.id]);
      if (!result.affectedRows) return res.status(404).json({ message: 'Ticket not found.' });
      res.json({ message: 'Ticket status updated.' });
    } catch { res.status(500).json({ message: 'Unable to update ticket.' }); }
  });
  return router;
}
module.exports = { createSupportRouter };
