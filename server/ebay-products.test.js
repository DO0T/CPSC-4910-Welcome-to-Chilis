jest.mock('./ebay-auth', () => ({ getAccessToken: jest.fn().mockResolvedValue('test-token') }));

const originalFetch = global.fetch;
const originalEnvironment = process.env.EBAY_ENVIRONMENT;
const ebay = require('./ebay-products');

const listing = {
  itemId: 'v1|12345|0',
  title: 'Travel mug',
  image: { imageUrl: 'https://example.test/mug.jpg' },
  itemWebUrl: 'https://www.ebay.com/itm/12345',
  price: { value: '19.95', currency: 'USD' },
  buyingOptions: ['FIXED_PRICE'],
};

beforeEach(() => { process.env.EBAY_ENVIRONMENT = 'sandbox'; });
afterEach(() => {
  global.fetch = originalFetch;
  if (originalEnvironment === undefined) delete process.env.EBAY_ENVIRONMENT;
  else process.env.EBAY_ENVIRONMENT = originalEnvironment;
});

test('searches fixed-price US eBay listings and normalizes their display fields', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ itemSummaries: [listing] }) });
  expect(await ebay.searchItems('travel mug')).toEqual([expect.objectContaining({
    itemId: 'v1|12345|0', title: 'Travel mug', price: '19.95', currency: 'USD',
    available: true, fixedPrice: true,
  })]);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?');
  expect(new URL(url).searchParams.get('q')).toBe('travel mug');
  expect(new URL(url).searchParams.get('filter')).toBe('buyingOptions:{FIXED_PRICE}');
  expect(options.headers).toMatchObject({ Authorization: 'Bearer test-token', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' });
});

test('filters non-USD, auction-only, and ended listings', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ itemSummaries: [
    { ...listing, price: { value: '5', currency: 'EUR' } },
    { ...listing, buyingOptions: ['AUCTION'] },
    { ...listing, itemEndDate: '2020-01-01T00:00:00Z' },
  ] }) });
  expect(await ebay.searchItems('mug')).toEqual([]);
});

test('loads an eBay item before it can be added and rejects a mismatched ID', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => listing });
  expect(await ebay.getItem(listing.itemId)).toMatchObject({ itemId: listing.itemId, price: '19.95' });
  expect(global.fetch.mock.calls[0][0]).toBe('https://api.sandbox.ebay.com/buy/browse/v1/item/v1%7C12345%7C0');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...listing, itemId: 'v1|other|0' }) });
  await expect(ebay.getItem(listing.itemId)).rejects.toMatchObject({ status: 502 });
});

test('reports a missing listing without changing catalog data', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  await expect(ebay.getItem(listing.itemId)).rejects.toMatchObject({ status: 404 });
});

test('distinguishes an eBay timeout from a missing listing', async () => {
  global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
  await expect(ebay.getItem(listing.itemId)).rejects.toMatchObject({
    status: 504,
    message: 'eBay took too long to respond. Try again.',
  });
});

test('reports other network failures without claiming the listing is missing', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('network failure'));
  await expect(ebay.getItem(listing.itemId)).rejects.toMatchObject({
    status: 502,
    message: 'Could not reach eBay. Try again later.',
  });
});
