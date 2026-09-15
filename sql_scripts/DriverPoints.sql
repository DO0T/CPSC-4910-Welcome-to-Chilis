USE TEAM03_DB;

CREATE TABLE DriverPoints 
(
	id INT PRIMARY KEY AUTO_INCREMENT,
    driver_id INT,
    sponsor_id INT,
    point_change INT,
    reason VARCHAR(255),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason)
VALUES
	(1, 1, 50, 'Good driving behavior'),
    (1, 1, -10, 'Destroyed a package');
    

SELECT * FROM DriverPoints