// Mailtrap's transactional API is used only by the backend.
function createSupportEmailSender(env = process.env, fetchImpl = globalThis.fetch) {
  return async function sendSupportEmail({ to, subject, text }) {
    if (!env.MAILTRAP_API_TOKEN) throw new Error('Support email is not configured.');
    const response = await fetchImpl('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${env.MAILTRAP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          email: env.SUPPORT_FROM_EMAIL || 'support@welcometochilis.cpsc4911.com',
          name: 'Welcome to Chili\'s Support',
        },
        to: [{ email: to }], subject, text, category: 'Support',
      }),
    });
    if (!response.ok) throw new Error(`Support email delivery failed (HTTP ${response.status}).`);
  };
}
module.exports = { createSupportEmailSender };
