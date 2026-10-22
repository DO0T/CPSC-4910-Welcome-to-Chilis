CREATE TABLE DriverApplications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    sponsor_id INT NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'DENIED') NOT NULL DEFAULT 'PENDING',
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    decided_by INT NULL,
    INDEX idx_driver_sponsor_applied (driver_id, sponsor_id, applied_at),
    INDEX idx_sponsor_status_applied (sponsor_id, status, applied_at),
    CONSTRAINT fk_application_driver FOREIGN KEY (driver_id) REFERENCES Drivers(user_id),
    CONSTRAINT fk_application_sponsor FOREIGN KEY (sponsor_id) REFERENCES Sponsors(sponsor_id),
    CONSTRAINT fk_application_decider FOREIGN KEY (decided_by) REFERENCES Users(user_id)
);
