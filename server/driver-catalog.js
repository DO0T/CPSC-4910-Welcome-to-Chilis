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

  router.get('/purchases', async (req, res) => {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required' });
    try {
      const [rows] = await pool.query(
        `SELECT purchase_id, sponsor_id, sponsor_name, catalog_item_id, item_title,
                item_image_url, points_spent, status, purchased_at,
                (status = 'COMPLETED' AND purchased_at <= NOW()
                  AND NOW() < DATE_ADD(purchased_at, INTERVAL 24 HOUR)) AS can_cancel
         FROM DriverPurchases WHERE driver_id = ? ORDER BY purchased_at DESC, purchase_id DESC`,
        [req.userId]
      );
      return res.json({ purchases: rows.map((row) => ({
        id: row.purchase_id, sponsorId: row.sponsor_id, sponsorName: row.sponsor_name,
        itemId: row.catalog_item_id, itemTitle: row.item_title, imageUrl: row.item_image_url || '',
        pointsSpent: Number(row.points_spent), status: row.status, purchasedAt: row.purchased_at,
        canCancel: Number(row.can_cancel) === 1,
      })) });
    } catch (error) {
      console.error('Load purchases error:', error);
      if (error.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ message: 'Purchase records are not set up yet.' });
      return res.status(500).json({ message: 'Unable to load purchases.' });
    }
  });

  router.post('/purchases/:id/cancel', async (req, res) => {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required' });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid purchase.' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      // Lock in the same order as checkout to serialize refunds and point spending.
      const [drivers] = await connection.query('SELECT user_id FROM Drivers WHERE user_id = ? FOR UPDATE', [req.userId]);
      if (!drivers.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Driver account not found.' });
      }
      const [rows] = await connection.query(
        `SELECT purchase_id, sponsor_id, item_title, points_spent, status,
                (purchased_at <= NOW() AND NOW() < DATE_ADD(purchased_at, INTERVAL 24 HOUR)) AS within_window
         FROM DriverPurchases WHERE purchase_id = ? AND driver_id = ? FOR UPDATE`, [id, req.userId]
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Purchase not found.' });
      }
      const purchase = rows[0];
      if (purchase.status !== 'COMPLETED' || Number(purchase.within_window) !== 1) {
        await connection.rollback();
        return res.status(409).json({ message: 'This purchase has already been cancelled or its 24-hour cancellation window has ended.' });
      }
      await connection.query('UPDATE DriverPurchases SET status = ? WHERE purchase_id = ? AND driver_id = ?', ['CANCELLED', id, req.userId]);
      await connection.query('UPDATE Drivers SET total_points = COALESCE(total_points, 0) + ? WHERE user_id = ?', [purchase.points_spent, req.userId]);
      await connection.query(
        'INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason) VALUES (?, ?, ?, ?)',
        [req.userId, purchase.sponsor_id, purchase.points_spent, `Refund for simulated purchase #${id}: ${purchase.item_title}`.slice(0, 255)]
      );
      await connection.commit();
      return res.json({ message: 'Purchase cancelled and points returned to the original sponsor.', status: 'CANCELLED' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Cancel purchase error:', error);
      if (error.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ message: 'Purchase records are not set up yet.' });
      return res.status(500).json({ message: 'Unable to cancel the purchase.' });
    } finally {
      if (connection) connection.release();
    }
  });

  async function checkout(req, res, cartMode) {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required' });
    const { itemId, sponsorId, pointCost: expectedCost } = req.body || {};
    const requestedItems = cartMode ? req.body?.items : [{ itemId, pointCost: expectedCost }];
    if (!Number.isSafeInteger(sponsorId) || sponsorId <= 0 || !Array.isArray(requestedItems) ||
        requestedItems.length < 1 || requestedItems.length > 50 ||
        requestedItems.some((item) => !item || ![item.itemId, item.pointCost].every((value) => Number.isSafeInteger(value) && value > 0)) ||
        new Set(requestedItems.map((item) => item.itemId)).size !== requestedItems.length) {
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
      const validatedItems = [];
      for (const requested of [...requestedItems].sort((a, b) => a.itemId - b.itemId)) {
        const [items] = await connection.query(
        `SELECT i.title, i.image_url, i.ebay_price, i.price_override, s.point_value, s.company_name
         FROM SponsorCatalogItems i JOIN Sponsors s ON s.sponsor_id = i.sponsor_id
         WHERE (EXISTS (SELECT 1 FROM DriverSponsorships ds WHERE ds.sponsor_id = i.sponsor_id AND ds.driver_id = ?) OR EXISTS (SELECT 1 FROM DriverPostRemovalAccess a WHERE a.sponsor_id = i.sponsor_id AND a.driver_id = ? AND a.expires_at > NOW())) AND i.id = ? AND i.sponsor_id = ? AND i.active = 1 AND i.is_available = 1
           AND i.family_friendly_confirmed = 1 AND i.currency = 'USD' FOR UPDATE`,
        [req.userId, req.userId, requested.itemId, sponsorId]
      );
        if (!items.length) {
          await connection.rollback();
          return res.status(409).json({ message: 'This reward is no longer available. Reload the catalog.' });
        }
        const item = items[0];
        const cost = pointCost(item.price_override == null ? item.ebay_price : item.price_override, item.point_value);
        if (!cost || cost !== requested.pointCost) {
          await connection.rollback();
          return res.status(409).json({ message: 'The reward price has changed or is unavailable. Reload the catalog.' });
        }
        validatedItems.push({ ...item, itemId: requested.itemId, cost });
      }
      const totalCost = validatedItems.reduce((total, item) => total + item.cost, 0);
      if (!Number.isSafeInteger(totalCost) || totalCost > 2147483647) {
        await connection.rollback();
        return res.status(400).json({ message: 'The total point cost is too large.' });
      }
      const [balances] = await connection.query(
        'SELECT COALESCE(SUM(point_change), 0) AS balance FROM DriverPoints WHERE driver_id = ? AND sponsor_id = ?',
        [req.userId, sponsorId]
      );
      const balance = Number(balances[0].balance);
      if (balance < totalCost) {
        await connection.rollback();
        return res.status(409).json({ message: 'You do not have enough points with this sponsor.' });
      }
      await connection.query('UPDATE Drivers SET total_points = COALESCE(total_points, 0) - ? WHERE user_id = ?', [totalCost, req.userId]);
      const purchaseIds = [];
      for (const item of validatedItems) {
        const [pointTransaction] = await connection.query(
          'INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason) VALUES (?, ?, ?, ?)',
          [req.userId, sponsorId, -item.cost, `Simulated purchase: ${item.title}`.slice(0, 255)]
        );
        const [purchase] = await connection.query(
          `INSERT INTO DriverPurchases
           (driver_id, sponsor_id, catalog_item_id, point_transaction_id, sponsor_name, item_title, item_image_url, points_spent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.userId, sponsorId, item.itemId, pointTransaction.insertId, item.company_name, item.title, item.image_url || null, item.cost]
        );
        purchaseIds.push(purchase.insertId);
      }
      await connection.commit();
      return res.json({ message: 'Simulated purchase complete. No real order was placed.', balance: balance - totalCost, ...(cartMode ? { purchaseIds } : { purchaseId: purchaseIds[0] }) });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Simulated purchase error:', error);
      if (error.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ message: 'Purchase records are not set up yet. Please contact an administrator.' });
      return res.status(500).json({ message: 'Unable to complete the simulated purchase.' });
    } finally {
      if (connection) connection.release();
    }
  }
  router.post('/purchase', (req, res) => checkout(req, res, false));
  router.post('/checkout', (req, res) => checkout(req, res, true));

  return router;
}

module.exports = { createDriverCatalogRouter };
