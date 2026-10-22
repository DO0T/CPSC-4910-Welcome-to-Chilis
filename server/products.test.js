const originalFetch = global.fetch;
const originalId = process.env.EBAY_CLIENT_ID;
const originalSecret = process.env.EBAY_CLIENT_SECRET;
const products = require('./products');
const ebay = require('./ebay-products');

beforeEach(() => {
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
});
afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
  if (originalId === undefined) delete process.env.EBAY_CLIENT_ID;
  else process.env.EBAY_CLIENT_ID = originalId;
  if (originalSecret === undefined) delete process.env.EBAY_CLIENT_SECRET;
  else process.env.EBAY_CLIENT_SECRET = originalSecret;
});

test('uses eBay search when server credentials are configured while retaining saved sample items', async () => {
  process.env.EBAY_CLIENT_ID = 'test-client';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  jest.spyOn(ebay, 'searchItems').mockResolvedValue([{ itemId: 'v1|12345|0' }]);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 23, title: 'Mug', price: 10, stock: 1 }) });

  expect(products.activeSource()).toBe('eBay');
  expect(await products.searchItems('mug')).toEqual([{ itemId: 'v1|12345|0' }]);
  expect(ebay.searchItems).toHaveBeenCalledWith('mug');
  expect(await products.getItem('dummyjson:23')).toMatchObject({ itemId: 'dummyjson:23' });
});

test('searches DummyJSON without credentials and normalizes sample products', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ products: [{ id: 23, title: 'Travel mug', thumbnail: 'https://example.test/mug.jpg', price: 14.5, stock: 12 }] }),
  });
  const results = await products.searchItems('travel mug');
  expect(results[0]).toMatchObject({ itemId: 'dummyjson:23', title: 'Travel mug', price: '14.50', currency: 'USD', available: true, mediaRating: null });
  expect(global.fetch.mock.calls[0][0]).toBe('https://dummyjson.com/products/search?q=travel+mug&limit=20');
});

test('loads only a valid DummyJSON product ID and recognizes out-of-stock products', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 23, title: 'Mug', price: 10, stock: 0 }) });
  expect(await products.getItem('dummyjson:23')).toMatchObject({ available: false, itemUrl: 'https://dummyjson.com/products/23' });
  await expect(products.getItem('demo|mug')).rejects.toMatchObject({ status: 400 });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('reports a missing product without fabricating a result', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 404, ok: false });
  await expect(products.getItem('dummyjson:23')).rejects.toMatchObject({ status: 404 });
});

test('reports service outages and invalid search responses', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(products.searchItems('mug')).rejects.toMatchObject({ status: 502 });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: null }) });
  await expect(products.searchItems('mug')).rejects.toMatchObject({ status: 502 });
});
