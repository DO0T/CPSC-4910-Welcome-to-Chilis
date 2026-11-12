const express = require('express');
const { pointCost } = require('./sponsor-catalog');

function createDriverCatalogRouter(pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (req.userRole !== 'Driver') {
      return res.status(403).json({ message: 'Driver access required' });
    }

    try {
      const requestedSponsor = req.query.sponsorId === undefined ? null : Number(req.query.sponsorId);
      if (requestedSponsor !== null && (!Number.isSafeInteger(requestedSponsor) || requestedSponsor <= 0)) return res.status(400).json({ message: 'Invalid sponsor.' });
      if (requestedSponsor !== null) {
        const [access] = await pool.query(`SELECT s.sponsor_id, s.company_name, s.point_value,
          COALESCE((SELECT SUM(point_change) FROM DriverPoints WHERE driver_id = ? AND sponsor_id = s.sponsor_id), 0) AS balance
          FROM DriverPostRemovalAccess a JOIN Sponsors s ON s.sponsor_id = a.sponsor_id
          WHERE a.driver_id = ? AND a.sponsor_id = ? AND a.expires_at > NOW()
          AND NOT EXISTS (SELECT 1 FROM DriverSponsorships ds WHERE ds.driver_id = a.driver_id AND ds.sponsor_id = a.sponsor_id)`, [req.userId, req.userId, requestedSponsor]);
        if (!access.length) return res.status(403).json({ message: 'Post-removal access is unavailable or expired.' });
        const driver = access[0];
        const [items] = await pool.query(`SELECT id, title, image_url, item_url, media_rating, ebay_price, price_override, currency FROM SponsorCatalogItems WHERE sponsor_id = ? AND active = 1 AND is_available = 1 AND family_friendly_confirmed = 1 AND currency = 'USD' ORDER BY created_at DESC, id DESC`, [requestedSponsor]);
        return res.json({ sponsorId: driver.sponsor_id, companyName: driver.company_name, pointValue: driver.point_value == null ? null : Number(driver.point_value), balance: Number(driver.balance || 0), items: items.map(item => ({ id: item.id, title: item.title, imageUrl: item.image_url || '', itemUrl: item.item_url || '', mediaRating: item.media_rating || null, pointCost: pointCost(item.price_override == null ? item.ebay_price : item.price_override, driver.point_value) })) });
      }
      const [drivers] = await pool.query(
        `SELECT d.sponsor_id, s.company_name, s.point_value,
                COALESCE((SELECT SUM(p.point_change) FROM DriverPoints p
                  WHERE p.driver_id = d.user_id AND p.sponsor_id = d.sponsor_id), 0) AS balance,
                ds.driver_id AS membership_driver_id
         FROM Drivers d
         LEFT JOIN Sponsors s ON s.sponsor_id = d.sponsor_id
         LEFT JOIN DriverSponsorships ds
           ON ds.driver_id = d.user_id AND ds.sponsor_id = d.sponsor_id
         WHERE d.user_id = ? LIMIT 1`,
        [req.userId]
      );
      if (drivers.length === 0) {
        return res.status(404).json({ message: 'Driver account not found' });
      }
      const driver = drivers[0];
      if (!driver.sponsor_id || !driver.membership_driver_id) {
        return res.status(409).json({ message: 'Choose one of your sponsors on the dashboard to view a catalog.' });
      }

      const [items] = await pool.query(
        `SELECT id, title, image_url, item_url, media_rating, ebay_price, price_override, currency
         FROM SponsorCatalogItems
         WHERE sponsor_id = ? AND active = 1 AND is_available = 1
           AND family_friendly_confirmed = 1 AND currency = 'USD'
         ORDER BY created_at DESC, id DESC`,
        [driver.sponsor_id]
      );

      return res.json({
        sponsorId: driver.sponsor_id,
        companyName: driver.company_name,
        pointValue: driver.point_value == null ? null : Number(driver.point_value),
        balance: Number(driver.balance || 0),
        items: items.map((item) => {
          const effectivePrice = item.price_override == null ? item.ebay_price : item.price_override;
          return {
            id: item.id,
            title: item.title,
            imageUrl: item.image_url || '',
            itemUrl: item.item_url || '',
            mediaRating: item.media_rating || null,
            pointCost: pointCost(effectivePrice, driver.point_value),
          };
        }),
      });
    } catch (error) {
      console.error('Load driver catalog error:', error);
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(503).json({ message: 'Catalog data is not set up yet.' });
      }
      return res.status(500).json({ message: 'Unable to load the catalog.' });
    }
  });

  router.post('/purchase', async (req, res) => {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required' });
    const { itemId, sponsorId, pointCost: expectedCost } = req.body || {};
    if (![itemId, sponsorId, expectedCost].every((value) => Number.isSafeInteger(value) && value > 0)) {
      return res.status(400).json({ message: 'Invalid purchase request.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      // All point changes update the driver row, which serializes balance checks and deductions.
      const [drivers] = await connection.query(
        'SELECT sponsor_id FROM Drivers WHERE user_id = ? FOR UPDATE', [req.userId]
      );
      if (!drivers.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Driver account not found.' });
      }
      const [access] = await connection.query(`SELECT 1 FROM DriverPostRemovalAccess a WHERE a.driver_id = ? AND a.sponsor_id = ? AND a.expires_at > NOW() AND NOT EXISTS (SELECT 1 FROM DriverSponsorships ds WHERE ds.driver_id = a.driver_id AND ds.sponsor_id = a.sponsor_id)`, [req.userId, sponsorId]);
      if (Number(drivers[0].sponsor_id) !== sponsorId && !access.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Your active sponsor changed. Reload the catalog before purchasing.' });
      }
      const [items] = await connection.query(
        `SELECT i.title, i.ebay_price, i.price_override, s.point_value
         FROM SponsorCatalogItems i JOIN Sponsors s ON s.sponsor_id = i.sponsor_id
         WHERE (EXISTS (SELECT 1 FROM DriverSponsorships ds WHERE ds.sponsor_id = i.sponsor_id AND ds.driver_id = ?) OR EXISTS (SELECT 1 FROM DriverPostRemovalAccess a WHERE a.sponsor_id = i.sponsor_id AND a.driver_id = ? AND a.expires_at > NOW())) AND i.id = ? AND i.sponsor_id = ? AND i.active = 1 AND i.is_available = 1
           AND i.family_friendly_confirmed = 1 AND i.currency = 'USD' FOR UPDATE`,
        [req.userId, req.userId, itemId, sponsorId]
      );
      if (!items.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'This reward is no longer available. Reload the catalog.' });
      }
      const item = items[0];
      const cost = pointCost(item.price_override == null ? item.ebay_price : item.price_override, item.point_value);
      if (!cost || cost !== expectedCost) {
        await connection.rollback();
        return res.status(409).json({ message: 'The reward price has changed or is unavailable. Reload the catalog.' });
      }
      const [balances] = await connection.query(
        'SELECT COALESCE(SUM(point_change), 0) AS balance FROM DriverPoints WHERE driver_id = ? AND sponsor_id = ?',
        [req.userId, sponsorId]
      );
      const balance = Number(balances[0].balance);
      if (balance < cost) {
        await connection.rollback();
        return res.status(409).json({ message: 'You do not have enough points with this sponsor.' });
      }
      await connection.query('UPDATE Drivers SET total_points = COALESCE(total_points, 0) - ? WHERE user_id = ?', [cost, req.userId]);
      await connection.query(
        'INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason) VALUES (?, ?, ?, ?)',
        [req.userId, sponsorId, -cost, `Simulated purchase: ${item.title}`.slice(0, 255)]
      );
      await connection.commit();
      return res.json({ message: 'Simulated purchase complete. No real order was placed.', balance: balance - cost });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Simulated purchase error:', error);
      return res.status(500).json({ message: 'Unable to complete the simulated purchase.' });
    } finally {
      if (connection) connection.release();
    }
  });

  return router;
}

module.exports = { createDriverCatalogRouter };
