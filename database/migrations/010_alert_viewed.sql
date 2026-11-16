-- Existing alerts start unviewed until the user opens their alert history.
ALTER TABLE UserAlerts ADD COLUMN is_viewed TINYINT(1) NOT NULL DEFAULT 0;
