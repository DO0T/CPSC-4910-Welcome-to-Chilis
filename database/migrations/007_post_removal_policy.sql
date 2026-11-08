ALTER TABLE Sponsors ADD COLUMN post_removal_days INT NOT NULL DEFAULT 0;

CREATE TABLE DriverPostRemovalAccess (
  driver_id INT NOT NULL,
  sponsor_id INT NOT NULL,
  removed_at DATETIME NOT NULL,
  expires_at DATETIME NULL,
  PRIMARY KEY (driver_id, sponsor_id),
  FOREIGN KEY (driver_id) REFERENCES Drivers(user_id),
  FOREIGN KEY (sponsor_id) REFERENCES Sponsors(sponsor_id)
);
