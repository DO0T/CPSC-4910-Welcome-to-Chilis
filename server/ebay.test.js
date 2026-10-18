const originalClientId = process.env.EBAY_CLIENT_ID;
const originalClientSecret = process.env.EBAY_CLIENT_SECRET;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalClientId === undefined) delete process.env.EBAY_CLIENT_ID;
  else process.env.EBAY_CLIENT_ID = originalClientId;
  if (originalClientSecret === undefined) delete process.env.EBAY_CLIENT_SECRET;
  else process.env.EBAY_CLIENT_SECRET = originalClientSecret;
  global.fetch = originalFetch;
  jest.resetModules();
});

test('uses demo search without requesting eBay when credentials are absent', async () => {
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
  global.fetch = jest.fn();
  const ebay = require('./ebay');
  const results = await ebay.searchItems('mug');
  expect(results).toHaveLength(1);
  expect(results[0].itemId).toBe('demo|travel-mug');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('keeps demo items refreshable after live credentials are configured', async () => {
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  global.fetch = jest.fn();
  const ebay = require('./ebay');
  expect((await ebay.getItem('demo|travel-mug')).price).toBe('24.50');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('uses server credentials and the US fixed-price search endpoint', async () => {
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'test-token', expires_in: 7200 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ itemSummaries: [{ itemId: 'v1|42|0', title: 'Travel mug', image: { imageUrl: 'https://example.test/mug.jpg' }, price: { value: '14.50', currency: 'USD' }, buyingOptions: ['FIXED_PRICE'] }] }) });
  const ebay = require('./ebay');
  const results = await ebay.searchItems('travel mug');
  expect(results[0]).toMatchObject({ itemId: 'v1|42|0', price: '14.50', fixedPrice: true });
  expect(global.fetch.mock.calls[1][0]).toContain('q=travel+mug');
  expect(global.fetch.mock.calls[1][0]).toContain('buyingOptions');
  expect(global.fetch.mock.calls[1][1].headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US');
});

test('reports eBay outages without returning fabricated live results', async () => {
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const ebay = require('./ebay');
  await expect(ebay.searchItems('mug')).rejects.toMatchObject({ status: 502 });
});

test('reads an explicit media rating from eBay item details', async () => {
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'test-token', expires_in: 7200 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      itemId: 'v1|film|0', title: 'Film', price: { value: '10.00', currency: 'USD' },
      localizedAspects: [{ name: 'Rating', value: 'PG-13' }], buyingOptions: ['FIXED_PRICE'],
    }) });
  const ebay = require('./ebay');
  expect((await ebay.getItem('v1|film|0')).mediaRating).toBe('PG-13');
});
