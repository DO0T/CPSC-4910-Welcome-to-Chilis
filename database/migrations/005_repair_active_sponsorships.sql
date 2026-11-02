-- Run only after reviewing points-preflight.sql and backing up the target database.
-- Sponsor-specific balances are calculated from DriverPoints; NULL-sponsor
-- transactions stay unassigned. This preserves the existing aggregate balance.
INSERT INTO DriverSponsorships (driver_id, sponsor_id)
SELECT d.user_id, d.sponsor_id
FROM Drivers d
WHERE d.sponsor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM DriverSponsorships ds
    WHERE ds.driver_id = d.user_id AND ds.sponsor_id = d.sponsor_id
  );
