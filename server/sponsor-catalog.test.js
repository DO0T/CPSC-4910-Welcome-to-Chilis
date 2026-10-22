const express = require('express');
const request = require('supertest');

jest.mock('./products', () => ({
  searchItems: jest.fn(),
  getItem: jest.fn(),
  activeSource: jest.fn().mockReturnValue('DummyJSON'),
}));

const products = require('./products');
const { createSponsorCatalogRouter, pointCost } = require('./sponsor-catalog');
const pool = { query: jest.fn() };
const sessionData = {};
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.userId = Number(req.get('X-Test-User') || 12);
  req.userRole = req.get('X-Test-Role') || 'Sponsor';
  req.sessionData = sessionData;
  next();
});
app.use('/api/sponsor/catalog', createSponsorCatalogRouter(pool));

const sponsor = { sponsor_id: 7, company_name: 'North Star', point_value: '0.01' };
const listing = { itemId: 'dummyjson:23', title: 'Travel mug', imageUrl: '', itemUrl: '', price: '19.95', currency: 'USD', mediaRating: null, available: true, fixedPrice: true };

beforeEach(() => {
  sessionData.catalogSearch = null;
  pool.query.mockReset();
  products.searchItems.mockReset();
  products.getItem.mockReset();
  pool.query.mockResolvedValue([[sponsor]]);
  products.getItem.mockResolvedValue(listing);
});

test('converts effective USD price to whole points by rounding up', () => {
  expect(pointCost('19.95', '0.01')).toBe(1995);
  expect(pointCost('19.95', '0.03')).toBe(665);
  expect(pointCost('19.95', '0.00')).toBeNull();
});

test('rejects non-sponsor roles before any catalog query', async () => {
  const response = await request(app).get('/api/sponsor/catalog').set('X-Test-Role', 'Driver');
  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('lists only active items for the linked sponsor and calculates override points', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]])
    .mockResolvedValueOnce([[{ id: 2, ebay_item_id: listing.itemId, title: 'Travel mug', ebay_price: '19.95', price_override: '10.00', currency: 'USD', is_available: 1 }]]);
  const response = await request(app).get('/api/sponsor/catalog');
  expect(response.statusCode).toBe(200);
  expect(response.body.items[0].pointCost).toBe(1000);
  expect(response.body.items[0]).toMatchObject({ source: 'DummyJSON', sourcePrice: '19.95' });
  expect(response.body.productSource).toBe('DummyJSON');
  expect(pool.query.mock.calls[1][1]).toEqual([7]);
  expect(pool.query.mock.calls[1][0]).toContain('active = 1');
});

test('searches only after resolving the sponsor and returns sample products', async () => {
  products.searchItems.mockResolvedValue([listing]);
  const response = await request(app).get('/api/sponsor/catalog/search?q=mug');
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ items: [listing] });
  expect(sessionData.catalogSearch.items.get(listing.itemId)).toEqual(listing);
});

test('requires a fresh search from the same sponsor before adding', async () => {
  const body = { itemId: listing.itemId, familyFriendlyConfirmed: true };
  const noSearch = await request(app).post('/api/sponsor/catalog').send(body);
  expect(noSearch.statusCode).toBe(409);
  sessionData.catalogSearch = { sponsorId: 99, source: 'DummyJSON', searchedAt: Date.now(), items: new Map([[listing.itemId, listing]]) };
  const otherSponsor = await request(app).post('/api/sponsor/catalog').send(body);
  expect(otherSponsor.statusCode).toBe(409);
  sessionData.catalogSearch.sponsorId = sponsor.sponsor_id;
  sessionData.catalogSearch.searchedAt = Date.now() - 16 * 60 * 1000;
  const expired = await request(app).post('/api/sponsor/catalog').send(body);
  expect(expired.statusCode).toBe(409);
  expect(products.getItem).not.toHaveBeenCalled();
  expect(pool.query).toHaveBeenCalledTimes(3);
});

test('requires family-friendly approval and rejects non-G/PG rated media', async () => {
  const missingApproval = await request(app).post('/api/sponsor/catalog').send({ itemId: listing.itemId });
  expect(missingApproval.statusCode).toBe(400);
  expect(products.getItem).not.toHaveBeenCalled();
  products.searchItems.mockResolvedValue([{ ...listing, mediaRating: 'R' }]);
  await request(app).get('/api/sponsor/catalog/search?q=mug');
  const rated = await request(app).post('/api/sponsor/catalog').send({ itemId: listing.itemId, familyFriendlyConfirmed: true });
  expect(rated.statusCode).toBe(400);
  expect(pool.query).toHaveBeenCalledTimes(3);
});

test('adds a searched listing without item details, ignores browser-supplied prices, and rejects duplicates', async () => {
  products.searchItems.mockResolvedValue([listing]);
  await request(app).get('/api/sponsor/catalog/search?q=mug');
  pool.query.mockReset();
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 5 }]);
  const added = await request(app).post('/api/sponsor/catalog').send({ itemId: listing.itemId, familyFriendlyConfirmed: true, sponsorId: 999, price: '0.01', title: 'Forged' });
  expect(added.statusCode).toBe(201);
  expect(pool.query.mock.calls[2][1][0]).toBe(listing.title);
  expect(pool.query.mock.calls[2][1][3]).toBe(listing.price);
  expect(pool.query.mock.calls[2][1].slice(-2)).toEqual([7, listing.itemId]);
  expect(products.getItem).not.toHaveBeenCalled();

  pool.query.mockReset();
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[{ id: 5, active: 1 }]]);
  const duplicate = await request(app).post('/api/sponsor/catalog').send({ itemId: listing.itemId, familyFriendlyConfirmed: true });
  expect(duplicate.statusCode).toBe(409);
});

test('validates override prices and scopes updates to the linked sponsor', async () => {
  const bad = await request(app).patch('/api/sponsor/catalog/5').send({ priceOverride: '0' });
  expect(bad.statusCode).toBe(400);
  pool.query.mockReset();
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([{ affectedRows: 0 }]);
  const otherSponsor = await request(app).patch('/api/sponsor/catalog/5').send({ priceOverride: '18.50' });
  expect(otherSponsor.statusCode).toBe(404);
  expect(pool.query.mock.calls[1][1]).toEqual(['18.50', 5, 7]);
});

test('refresh updates source price without touching sponsor price override', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[{ ebay_item_id: listing.itemId }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
  const response = await request(app).post('/api/sponsor/catalog/5/refresh');
  expect(response.statusCode).toBe(200);
  expect(pool.query.mock.calls[2][0]).not.toContain('price_override');
  expect(pool.query.mock.calls[2][1].slice(-2)).toEqual([5, 7]);
});

test('marks an ended listing unavailable and keeps it in the catalog', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[{ ebay_item_id: listing.itemId }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
  products.getItem.mockRejectedValue({ status: 404, message: 'No longer available.' });
  const response = await request(app).post('/api/sponsor/catalog/5/refresh');
  expect(response.statusCode).toBe(200);
  expect(pool.query.mock.calls[2][0]).toContain('is_available = 0');
});

test('keeps catalog data unchanged when DummyJSON fails', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[{ ebay_item_id: listing.itemId }]]);
  products.getItem.mockRejectedValue({ status: 502, message: 'DummyJSON is unavailable.' });
  const response = await request(app).post('/api/sponsor/catalog/5/refresh');
  expect(response.statusCode).toBe(502);
  expect(pool.query).toHaveBeenCalledTimes(2);
});

test('keeps legacy eBay records visible but does not refresh invalid older IDs', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[{ ebay_item_id: 'demo|mug' }]]);
  const response = await request(app).post('/api/sponsor/catalog/5/refresh');
  expect(response.statusCode).toBe(409);
  expect(products.getItem).not.toHaveBeenCalled();
  expect(pool.query).toHaveBeenCalledTimes(2);
});

test('refreshes current eBay item IDs through the product provider', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([[{ ebay_item_id: 'v1|12345|0' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
  products.getItem.mockResolvedValue({ ...listing, itemId: 'v1|12345|0' });
  const response = await request(app).post('/api/sponsor/catalog/5/refresh');
  expect(response.statusCode).toBe(200);
  expect(products.getItem).toHaveBeenCalledWith('v1|12345|0');
  expect(pool.query.mock.calls[2][0]).not.toContain('price_override');
});

test('soft-removes only the linked sponsor item', async () => {
  pool.query.mockResolvedValueOnce([[sponsor]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
  const response = await request(app).delete('/api/sponsor/catalog/5');
  expect(response.statusCode).toBe(200);
  expect(pool.query.mock.calls[1][0]).toContain('active = 0');
  expect(pool.query.mock.calls[1][1]).toEqual([5, 7]);
});
