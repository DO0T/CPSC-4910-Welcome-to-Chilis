-- Simulated purchases are recorded alongside their sponsor-specific point deduction.
-- Snapshots preserve the receipt if a catalog item or sponsor is later renamed.
CREATE TABLE IF NOT EXISTS DriverPurchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    sponsor_id INT NOT NULL,
    catalog_item_id INT NOT NULL,
    point_transaction_id INT NOT NULL,
    sponsor_name VARCHAR(255) NOT NULL,
    item_title VARCHAR(500) NOT NULL,
    item_image_url VARCHAR(2048) NULL,
    points_spent INT NOT NULL,
    status ENUM('COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
    purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_purchase_point_transaction (point_transaction_id),
    INDEX idx_purchase_driver_date (driver_id, purchased_at, purchase_id),
    INDEX idx_purchase_sponsor (sponsor_id)
) ENGINE=InnoDB;
