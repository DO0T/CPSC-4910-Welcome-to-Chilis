CREATE TABLE PointDisputes (
  dispute_id INT AUTO_INCREMENT PRIMARY KEY,
  point_id INT NOT NULL,
  driver_id INT NOT NULL,
  sponsor_id INT NOT NULL,
  status ENUM('OPEN', 'ACCEPTED', 'DENIED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_disputed_point (point_id),
  FOREIGN KEY (point_id) REFERENCES DriverPoints(id),
  FOREIGN KEY (driver_id) REFERENCES Users(user_id),
  FOREIGN KEY (sponsor_id) REFERENCES Sponsors(sponsor_id)
);

CREATE TABLE PointDisputeMessages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  dispute_id INT NOT NULL,
  author_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dispute_id) REFERENCES PointDisputes(dispute_id),
  FOREIGN KEY (author_id) REFERENCES Users(user_id)
);

CREATE TABLE DisputeNotificationPreferences (
  user_id INT PRIMARY KEY,
  driver_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
