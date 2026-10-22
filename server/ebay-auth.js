const SCOPE = 'https://api.ebay.com/oauth/api_scope';

let cachedToken = null;
let expiresAt = 0;
let cachedCredentials = null;

class EbayAuthError extends Error {
  constructor(message) {
    super(message);
    this.status = 503;
  }
}

async function getAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const environment = process.env.EBAY_ENVIRONMENT || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new EbayAuthError('eBay credentials are not configured on the server.');
  }
  if (!['sandbox', 'production'].includes(environment)) {
    throw new EbayAuthError('Invalid eBay environment configuration.');
  }

  const credentials = `${environment}:${clientId}:${clientSecret}`;
  if (credentials === cachedCredentials && cachedToken && Date.now() < expiresAt) {
    return cachedToken;
  }

  const host = environment === 'sandbox' ? 'api.sandbox.ebay.com' : 'api.ebay.com';
  let response;
  try {
    response = await fetch(`https://${host}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE }).toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new EbayAuthError('Could not reach eBay authentication. Try again later.');
  }

  if (!response.ok) throw new EbayAuthError('eBay authentication failed. Check the server keyset.');

  let data;
  try {
    data = await response.json();
  } catch {
    throw new EbayAuthError('eBay authentication returned an invalid response.');
  }
  if (typeof data.access_token !== 'string' || !data.access_token ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    throw new EbayAuthError('eBay authentication returned an invalid response.');
  }

  cachedToken = data.access_token;
  cachedCredentials = credentials;
  expiresAt = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
  return cachedToken;
}

module.exports = { getAccessToken, EbayAuthError };
