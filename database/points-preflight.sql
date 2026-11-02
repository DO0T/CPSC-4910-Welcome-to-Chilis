-- Read-only checks to run before designing the sponsor-specific points migration.
-- Review results privately: these queries include driver and sponsor identifiers.
-- No balances or transactions are changed.

-- Compare each legacy balance with its recorded, sponsor-tagged activity.
-- A difference means transaction history alone cannot safely reproduce the balance.
SELECT d.user_id AS driver_id, d.sponsor_id AS active_sponsor_id,
       COALESCE(d.total_points, 0) AS legacy_balance,
       COALESCE(SUM(CASE WHEN p.sponsor_id IS NOT NULL THEN p.point_change ELSE 0 END), 0) AS tagged_points,
       COALESCE(SUM(CASE WHEN p.sponsor_id IS NULL THEN p.point_change ELSE 0 END), 0) AS unassigned_points,
       COALESCE(d.total_points, 0) - COALESCE(SUM(p.point_change), 0) AS history_difference
FROM Drivers d
LEFT JOIN DriverPoints p ON p.driver_id = d.user_id
GROUP BY d.user_id, d.sponsor_id, d.total_points
HAVING history_difference <> 0 OR unassigned_points <> 0
   OR (d.sponsor_id IS NULL AND COALESCE(d.total_points, 0) <> 0);

-- Identify recorded sponsor activity without a matching sponsorship membership.
SELECT p.driver_id, p.sponsor_id, COUNT(*) AS transaction_count,
       SUM(p.point_change) AS net_points
FROM DriverPoints p
LEFT JOIN DriverSponsorships ds
  ON ds.driver_id = p.driver_id AND ds.sponsor_id = p.sponsor_id
WHERE p.sponsor_id IS NOT NULL AND ds.driver_id IS NULL
GROUP BY p.driver_id, p.sponsor_id;

-- Identify drivers with multiple memberships and their current aggregate balance.
SELECT d.user_id AS driver_id, d.sponsor_id AS active_sponsor_id,
       COALESCE(d.total_points, 0) AS legacy_balance, COUNT(*) AS sponsorships
FROM Drivers d
JOIN DriverSponsorships ds ON ds.driver_id = d.user_id
GROUP BY d.user_id, d.sponsor_id, d.total_points
HAVING COUNT(*) > 1;

-- Find transactions that do not belong to an existing driver. These cannot be
-- assigned to a membership automatically.
SELECT p.driver_id, COUNT(*) AS transaction_count,
       COALESCE(SUM(p.point_change), 0) AS net_points
FROM DriverPoints p
LEFT JOIN Drivers d ON d.user_id = p.driver_id
WHERE d.user_id IS NULL
GROUP BY p.driver_id;

-- A missing active membership would prevent a driver's current sponsor from
-- having a reliable balance after migration.
SELECT d.user_id AS driver_id, d.sponsor_id AS active_sponsor_id,
       COALESCE(d.total_points, 0) AS legacy_balance
FROM Drivers d
LEFT JOIN DriverSponsorships ds
  ON ds.driver_id = d.user_id AND ds.sponsor_id = d.sponsor_id
WHERE d.sponsor_id IS NOT NULL AND ds.driver_id IS NULL;
