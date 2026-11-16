-- Optional details for simulated purchases; existing purchases remain unchanged.
ALTER TABLE DriverPurchases
  ADD COLUMN delivery_address VARCHAR(500) NULL,
  ADD COLUMN contact_email VARCHAR(255) NULL;
