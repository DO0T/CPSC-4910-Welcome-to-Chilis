USE Team03_DB;

CREATE TABLE AuditLog
(
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_type VARCHAR(50) NOT NULL,
    user_id INT,
    driver_id INT,
    sponsor_id INT,
    action VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    reason VARCHAR(255),
    details TEXT,
    event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);