const BASE_URL = 'https://dummyjson.com/products';
const ITEM_PREFIX = 'dummyjson:';

class ProductError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function request(path) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ProductError('Sample products are unavailable. Try again later.');
  }
  if (response.status === 404) throw new ProductError('This sample product was not found.', 404);
  if (!response.ok) throw new ProductError('Sample products could not be loaded. Try again later.');
  try {
    return await response.json();
  } catch {
    throw new ProductError('The product service returned invalid data.');
  }
}

function normalizeProduct(product) {
  if (!Number.isSafeInteger(product?.id) || product.id < 1) return null;
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    itemId: `${ITEM_PREFIX}${product.id}`,
    title: product.title || 'Untitled product',
    imageUrl: product.thumbnail || product.images?.[0] || '',
    itemUrl: `${BASE_URL}/${product.id}`,
    price: price.toFixed(2),
    // DummyJSON's sample prices do not include a currency; this prototype treats them as USD.
    currency: 'USD',
    mediaRating: null,
    available: Number(product.stock) > 0,
    fixedPrice: true,
  };
}

async function searchItems(query) {
  const params = new URLSearchParams({ q: query, limit: '20' });
  const data = await request(`/search?${params}`);
  if (!Array.isArray(data.products)) throw new ProductError('The product service returned invalid search results.');
  return data.products.map(normalizeProduct).filter(Boolean);
}

async function getItem(itemId) {
  if (!/^dummyjson:[1-9]\d*$/.test(itemId)) throw new ProductError('This is not a DummyJSON product.', 400);
  const id = Number(itemId.slice(ITEM_PREFIX.length));
  if (!Number.isSafeInteger(id)) throw new ProductError('Invalid sample product ID.', 400);
  const item = normalizeProduct(await request(`/${id}`));
  if (!item || item.itemId !== itemId) throw new ProductError('The product service returned a different item.');
  return item;
}

module.exports = { searchItems, getItem, ProductError };
