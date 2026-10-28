const express = require('express');
const { pointCost } = require('./sponsor-catalog');

function createDriverCatalogRouter(pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (req.userRole !== 'Driver') {
      return res.status(403).json({ message: 'Driver access required' });
    }

    try {
      const [drivers] = await pool.query(
        `SELECT d.sponsor_id, s.company_name, s.point_value,
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
        `SELECT id, title, image_url, ebay_price, price_override, currency
         FROM SponsorCatalogItems
         WHERE sponsor_id = ? AND active = 1 AND is_available = 1
           AND family_friendly_confirmed = 1 AND currency = 'USD'
         ORDER BY created_at DESC, id DESC`,
        [driver.sponsor_id]
      );

      return res.json({
        sponsorId: driver.sponsor_id,
        companyName: driver.company_name,
        items: items.map((item) => {
          const effectivePrice = item.price_override == null ? item.ebay_price : item.price_override;
          return {
            id: item.id,
            title: item.title,
            imageUrl: item.image_url || '',
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

  return router;
}

module.exports = { createDriverCatalogRouter };
