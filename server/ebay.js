const DEMO_ITEMS = [
  { itemId: 'demo|road-atlas', title: 'Road atlas for the cab', imageUrl: '', itemUrl: '', price: '19.95', currency: 'USD', mediaRating: null, available: true, fixedPrice: true },
  { itemId: 'demo|travel-mug', title: 'Insulated travel mug', imageUrl: '', itemUrl: '', price: '24.50', currency: 'USD', mediaRating: null, available: true, fixedPrice: true },
  { itemId: 'demo|family-film', title: 'Family film on DVD', imageUrl: '', itemUrl: '', price: '12.99', currency: 'USD', mediaRating: 'PG', available: true, fixedPrice: true },
  { itemId: 'demo|rated-film', title: 'Adult-rated film on DVD', imageUrl: '', itemUrl: '', price: '15.00', currency: 'USD', mediaRating: 'R', available: true, fixedPrice: true },
];

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const BROWSE_URL = 'https://api.ebay.com/buy/browse/v1';
let tokenCache = null;

class EbayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function isDemoMode() {
  return !process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET;
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new EbayError('eBay is unavailable. Try again later.');
  }
  if (!response.ok) throw new EbayError('eBay authentication failed. Check the server credentials.');
  let data;
  try { data = await response.json(); } catch { throw new EbayError('eBay returned an invalid authentication response.'); }
  if (!data.access_token) throw new EbayError('eBay did not return an access token.');
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 7200) * 1000 };
  return tokenCache.value;
}

async function browse(path) {
  const token = await accessToken();
  let response;
  try {
    response = await fetch(`${BROWSE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new EbayError('eBay is unavailable. Try again later.');
  }
  if (response.status === 404) throw new EbayError('This eBay listing is no longer available.', 404);
  if (!response.ok) throw new EbayError('eBay could not load listings. Try again later.');
  try { return await response.json(); } catch { throw new EbayError('eBay returned invalid listing data.'); }
}

function mediaRating(data) {
  const productAspects = data.product?.aspects;
  const aspects = [
    ...(Array.isArray(data.localizedAspects) ? data.localizedAspects : []),
    ...(Array.isArray(productAspects) ? productAspects : []),
    ...(!Array.isArray(productAspects) && productAspects && typeof productAspects === 'object'
      ? Object.entries(productAspects).map(([name, value]) => ({ name, value })) : []),
  ];
  const aspect = aspects.find((entry) => /^(mpaa rating|content rating|motion picture rating|rating)$/i.test(entry.name || ''));
  if (!aspect) return null;
  const value = Array.isArray(aspect.value) ? aspect.value[0] : aspect.value;
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  const rated = normalized.match(/^(?:RATED\s+)?(G|PG)(?!-?13|\w)/);
  return rated ? rated[1] : normalized;
}

function normalizeItem(data) {
  const price = data.price || {};
  return {
    itemId: data.itemId,
    title: data.title || 'Untitled listing',
    imageUrl: data.image?.imageUrl || data.thumbnailImages?.[0]?.imageUrl || '',
    itemUrl: data.itemWebUrl || '',
    price: price.value == null ? null : String(price.value),
    currency: price.currency || '',
    mediaRating: mediaRating(data),
    fixedPrice: !Array.isArray(data.buyingOptions) || data.buyingOptions.includes('FIXED_PRICE'),
    available: data.estimatedAvailabilityStatus !== 'OUT_OF_STOCK' && (!data.itemEndDate || new Date(data.itemEndDate).getTime() > Date.now()),
  };
}

async function searchItems(query) {
  if (isDemoMode()) {
    return DEMO_ITEMS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  }
  const params = new URLSearchParams({ q: query, limit: '20', filter: 'buyingOptions:{FIXED_PRICE},priceCurrency:USD' });
  const data = await browse(`/item_summary/search?${params}`);
  return (data.itemSummaries || []).map(normalizeItem).filter((item) => item.currency === 'USD' && item.price != null && item.fixedPrice);
}

async function getItem(itemId) {
  if (itemId.startsWith('demo|')) {
    const item = DEMO_ITEMS.find((candidate) => candidate.itemId === itemId);
    if (!item) throw new EbayError('Demo listing not found.', 404);
    return item;
  }
  if (isDemoMode()) throw new EbayError('Live eBay listings need server credentials.', 503);
  const data = await browse(`/item/${encodeURIComponent(itemId)}`);
  return normalizeItem(data);
}

module.exports = { searchItems, getItem, isDemoMode, EbayError };
