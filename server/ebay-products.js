const { getAccessToken } = require('./ebay-auth');

class EbayProductError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function baseUrl() {
  return process.env.EBAY_ENVIRONMENT === 'production'
    ? 'https://api.ebay.com/buy/browse/v1'
    : 'https://api.sandbox.ebay.com/buy/browse/v1';
}

async function request(path) {
  const token = await getAccessToken();
  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new EbayProductError('eBay took too long to respond. Try again.', 504);
    }
    throw new EbayProductError('Could not reach eBay. Try again later.');
  }
  if (response.status === 404) throw new EbayProductError('This eBay listing was not found.', 404);
  if (!response.ok) throw new EbayProductError('eBay listings could not be loaded. Try again later.');
  try {
    return await response.json();
  } catch {
    throw new EbayProductError('eBay returned invalid listing data.');
  }
}

function normalize(item) {
  if (typeof item?.itemId !== 'string' || !item.itemId.startsWith('v1|') || item.itemId.length > 255) return null;
  const price = Number(item.price?.value);
  if (!Number.isFinite(price) || price <= 0 || item.price?.currency !== 'USD') return null;
  const endDate = item.itemEndDate ? Date.parse(item.itemEndDate) : null;
  const availability = item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus;
  return {
    itemId: item.itemId,
    title: item.title || 'Untitled eBay listing',
    imageUrl: item.image?.imageUrl || '',
    itemUrl: item.itemWebUrl || '',
    price: price.toFixed(2),
    currency: 'USD',
    mediaRating: null,
    available: (endDate === null || (Number.isFinite(endDate) && endDate > Date.now())) &&
      !['OUT_OF_STOCK', 'SOLD_OUT'].includes(availability),
    fixedPrice: Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE'),
  };
}

async function searchItems(query) {
  const params = new URLSearchParams({ q: query, limit: '20', filter: 'buyingOptions:{FIXED_PRICE}' });
  const data = await request(`/item_summary/search?${params}`);
  if (!Array.isArray(data.itemSummaries) && data.itemSummaries !== undefined) {
    throw new EbayProductError('eBay returned invalid search results.');
  }
  return (data.itemSummaries || []).map(normalize).filter((item) => item?.fixedPrice && item.available);
}

async function getItem(itemId) {
  if (typeof itemId !== 'string' || !itemId.startsWith('v1|') || itemId.length > 255) {
    throw new EbayProductError('Invalid eBay listing ID.', 400);
  }
  const item = normalize(await request(`/item/${encodeURIComponent(itemId)}`));
  if (!item || item.itemId !== itemId) throw new EbayProductError('eBay returned a different or invalid listing.');
  return item;
}

module.exports = { searchItems, getItem, EbayProductError };
