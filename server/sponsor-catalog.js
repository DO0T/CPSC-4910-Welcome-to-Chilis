const express = require('express');
const ebay = require('./ebay');

function money(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents > 0 ? cents : null;
}

function pointCost(price, pointValue) {
  const priceCents = money(price);
  const pointCents = money(pointValue);
  return priceCents && pointCents ? Math.ceil(priceCents / pointCents) : null;
}

function serialize(row, pointValue) {
  const effectivePrice = row.price_override == null ? row.ebay_price : row.price_override;
  return {
    id: row.id,
    itemId: row.ebay_item_id,
    demoItem: row.ebay_item_id.startsWith('demo|'),
    title: row.title,
    imageUrl: row.image_url || '',
    itemUrl: row.item_url || '',
    ebayPrice: String(row.ebay_price),
    priceOverride: row.price_override == null ? null : String(row.price_override),
    effectivePrice: String(effectivePrice),
    currency: row.currency,
    mediaRating: row.media_rating || null,
    familyFriendlyConfirmed: Boolean(row.family_friendly_confirmed),
    available: Boolean(row.is_available),
    pointCost: pointCost(effectivePrice, pointValue),
    lastCheckedAt: row.last_checked_at,
  };
}

function handleError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  console.error('Sponsor catalog error:', error);
  if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(503).json({ message: 'Catalog data is not set up yet. Apply the sponsor catalog database migration.' });
  }
  return res.status(500).json({ message: 'Unable to complete the catalog request.' });
}

function createSponsorCatalogRouter(pool) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    if (req.userRole !== 'Sponsor') return res.status(403).json({ message: 'Sponsor access required.' });
    try {
      const [rows] = await pool.query(
        `SELECT s.sponsor_id, s.company_name, s.point_value
         FROM SponsorUsers su JOIN Sponsors s ON s.sponsor_id = su.sponsor_id
         WHERE su.user_id = ? LIMIT 1`,
        [req.userId]
      );
      if (!rows.length) return res.status(403).json({ message: 'No sponsor organization is linked to this account.' });
      req.catalogSponsor = rows[0];
      next();
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM SponsorCatalogItems WHERE sponsor_id = ? AND active = 1 ORDER BY created_at DESC, id DESC',
        [req.catalogSponsor.sponsor_id]
      );
      res.json({
        companyName: req.catalogSponsor.company_name,
        pointValue: String(req.catalogSponsor.point_value),
        demoMode: ebay.isDemoMode(),
        items: rows.map((row) => serialize(row, req.catalogSponsor.point_value)),
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (query.length < 2 || query.length > 100) return res.status(400).json({ message: 'Enter 2–100 characters to search.' });
    try {
      const items = await ebay.searchItems(query);
      res.json({ demoMode: ebay.isDemoMode(), items });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/', async (req, res) => {
    const itemId = String(req.body?.itemId || '').trim();
    if (!itemId || itemId.length > 255) return res.status(400).json({ message: 'Select a valid listing.' });
    if (req.body?.familyFriendlyConfirmed !== true) return res.status(400).json({ message: 'Confirm this item is family-friendly before adding it.' });
    try {
      const item = await ebay.getItem(itemId);
      if (item.itemId !== itemId || item.currency !== 'USD' || !money(item.price)) {
        return res.status(400).json({ message: 'This listing needs a valid USD price.' });
      }
      if (!item.fixedPrice) return res.status(400).json({ message: 'Only fixed-price listings can be added.' });
      if (!item.available) return res.status(409).json({ message: 'This listing is no longer available.' });
      if (item.mediaRating && !['G', 'PG'].includes(item.mediaRating.toUpperCase())) {
        return res.status(400).json({ message: 'Only G or PG rated media can be added.' });
      }
      const sponsorId = req.catalogSponsor.sponsor_id;
      const [existing] = await pool.query(
        'SELECT id, active FROM SponsorCatalogItems WHERE sponsor_id = ? AND ebay_item_id = ? LIMIT 1',
        [sponsorId, itemId]
      );
      if (existing.length && existing[0].active) return res.status(409).json({ message: 'This item is already in your catalog.' });
      const fields = [item.title.slice(0, 500), item.imageUrl || null, item.itemUrl || null, item.price, item.mediaRating || null, sponsorId, itemId];
      if (existing.length) {
        await pool.query(
          `UPDATE SponsorCatalogItems SET title = ?, image_url = ?, item_url = ?, ebay_price = ?,
           media_rating = ?, price_override = NULL, family_friendly_confirmed = 1, is_available = 1, active = 1,
           last_checked_at = NOW() WHERE sponsor_id = ? AND ebay_item_id = ?`,
          fields
        );
      } else {
        await pool.query(
          `INSERT INTO SponsorCatalogItems
           (title, image_url, item_url, ebay_price, media_rating, family_friendly_confirmed,
            is_available, active, sponsor_id, ebay_item_id)
           VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?, ?)`,
          fields
        );
      }
      res.status(201).json({ message: 'Item added to your catalog.' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This item is already in your catalog.' });
      handleError(res, error);
    }
  });

  router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid catalog item.' });
    const override = req.body?.priceOverride;
    if (override !== null && money(override) === null) return res.status(400).json({ message: 'Enter a positive USD price with no more than two decimal places.' });
    try {
      const [result] = await pool.query(
        'UPDATE SponsorCatalogItems SET price_override = ? WHERE id = ? AND sponsor_id = ? AND active = 1',
        [override, id, req.catalogSponsor.sponsor_id]
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Catalog item not found.' });
      res.json({ message: override === null ? 'Price override cleared.' : 'Price override saved.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/:id/refresh', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid catalog item.' });
    try {
      const sponsorId = req.catalogSponsor.sponsor_id;
      const [rows] = await pool.query(
        'SELECT ebay_item_id FROM SponsorCatalogItems WHERE id = ? AND sponsor_id = ? AND active = 1 LIMIT 1',
        [id, sponsorId]
      );
      if (!rows.length) return res.status(404).json({ message: 'Catalog item not found.' });
      let item;
      try {
        item = await ebay.getItem(rows[0].ebay_item_id);
      } catch (error) {
        if (error.status !== 404) throw error;
        await pool.query(
          'UPDATE SponsorCatalogItems SET is_available = 0, last_checked_at = NOW() WHERE id = ? AND sponsor_id = ?',
          [id, sponsorId]
        );
        return res.json({ message: 'Listing is no longer available.' });
      }
      if (item.itemId !== rows[0].ebay_item_id) {
        return res.status(502).json({ message: 'eBay returned a different listing. The catalog was not changed.' });
      }
      const validPrice = item.currency === 'USD' && money(item.price) !== null;
      const available = item.available && item.fixedPrice !== false && validPrice &&
        (!item.mediaRating || ['G', 'PG'].includes(item.mediaRating.toUpperCase()));
      if (validPrice) {
        await pool.query(
          `UPDATE SponsorCatalogItems SET title = ?, image_url = ?, item_url = ?, ebay_price = ?,
           media_rating = ?, is_available = ?, last_checked_at = NOW()
           WHERE id = ? AND sponsor_id = ?`,
          [item.title.slice(0, 500), item.imageUrl || null, item.itemUrl || null,
            item.price, item.mediaRating || null, available ? 1 : 0, id, sponsorId]
        );
      } else {
        await pool.query(
          'UPDATE SponsorCatalogItems SET is_available = 0, last_checked_at = NOW() WHERE id = ? AND sponsor_id = ?',
          [id, sponsorId]
        );
      }
      res.json({ message: available ? 'eBay details refreshed.' : 'Listing updated and marked unavailable.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid catalog item.' });
    try {
      const [result] = await pool.query(
        'UPDATE SponsorCatalogItems SET active = 0 WHERE id = ? AND sponsor_id = ? AND active = 1',
        [id, req.catalogSponsor.sponsor_id]
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Catalog item not found.' });
      res.json({ message: 'Item removed from your catalog.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}

module.exports = { createSponsorCatalogRouter, pointCost };
