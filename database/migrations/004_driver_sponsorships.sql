CREATE TABLE DriverSponsorships (
    driver_id INT NOT NULL,
    sponsor_id INT NOT NULL,
    PRIMARY KEY (driver_id, sponsor_id),
    CONSTRAINT fk_sponsorship_driver FOREIGN KEY (driver_id) REFERENCES Drivers(user_id),
    CONSTRAINT fk_sponsorship_sponsor FOREIGN KEY (sponsor_id) REFERENCES Sponsors(sponsor_id)
);

-- Preserve the sponsor currently assigned to each driver.
INSERT INTO DriverSponsorships (driver_id, sponsor_id)
SELECT user_id, sponsor_id
FROM Drivers
WHERE sponsor_id IS NOT NULL;

-- Preserve approvals made before the sponsorship table existed.
INSERT INTO DriverSponsorships (driver_id, sponsor_id)
SELECT DISTINCT a.driver_id, a.sponsor_id
FROM DriverApplications a
WHERE a.status = 'APPROVED'
  AND NOT EXISTS (
      SELECT 1
      FROM DriverSponsorships ds
      WHERE ds.driver_id = a.driver_id AND ds.sponsor_id = a.sponsor_id
  );
