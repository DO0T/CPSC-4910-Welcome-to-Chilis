CREATE TABLE SiteNotifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    message VARCHAR(500) NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_site_notifications_window (starts_at, ends_at),
    FOREIGN KEY (created_by) REFERENCES Users(user_id)
);