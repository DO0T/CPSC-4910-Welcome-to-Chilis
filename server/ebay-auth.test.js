const originalFetch = global.fetch;
const originalId = process.env.EBAY_CLIENT_ID;
const originalSecret = process.env.EBAY_CLIENT_SECRET;
const originalEnvironment = process.env.EBAY_ENVIRONMENT;

beforeEach(() => {
  jest.resetModules();
  process.env.EBAY_CLIENT_ID = 'test-client';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  process.env.EBAY_ENVIRONMENT = 'sandbox';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalId === undefined) delete process.env.EBAY_CLIENT_ID;
  else process.env.EBAY_CLIENT_ID = originalId;
  if (originalSecret === undefined) delete process.env.EBAY_CLIENT_SECRET;
  else process.env.EBAY_CLIENT_SECRET = originalSecret;
  if (originalEnvironment === undefined) delete process.env.EBAY_ENVIRONMENT;
  else process.env.EBAY_ENVIRONMENT = originalEnvironment;
});

test('requests a sandbox application token and reuses it before expiration', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'test-token', expires_in: 7200 }),
  });
  const { getAccessToken } = require('./ebay-auth');
  expect(await getAccessToken()).toBe('test-token');
  expect(await getAccessToken()).toBe('test-token');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.sandbox.ebay.com/identity/v1/oauth2/token');
  expect(global.fetch.mock.calls[0][1]).toMatchObject({
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from('test-client:test-secret').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  expect(new URLSearchParams(global.fetch.mock.calls[0][1].body).get('scope'))
    .toBe('https://api.ebay.com/oauth/api_scope');
});

test('uses the production endpoint when configured for production', async () => {
  process.env.EBAY_ENVIRONMENT = 'production';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'production-token', expires_in: 7200 }),
  });
  await require('./ebay-auth').getAccessToken();
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.ebay.com/identity/v1/oauth2/token');
});

test('does not call eBay when credentials are missing', async () => {
  delete process.env.EBAY_CLIENT_SECRET;
  global.fetch = jest.fn();
  await expect(require('./ebay-auth').getAccessToken()).rejects.toMatchObject({ status: 503 });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('does not expose an eBay error response to the caller', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  await expect(require('./ebay-auth').getAccessToken()).rejects.toThrow('eBay authentication failed. Check the server keyset.');
});
