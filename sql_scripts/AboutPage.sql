USE Team03_DB;

CREATE TABLE AboutPage 
(
	id INT PRIMARY KEY AUTO_INCREMENT,
    team_number VARCHAR(10),
    version_number VARCHAR(10),
    release_date DATE,
    product_name VARCHAR(100),
    product_description TEXT
);

INSERT INTO AboutPage (team_number, version_number, release_date, product_name, product_description)
VALUES 
(
	'03',
    'Sprint 1',
    '2026-09-14',
    'Good Driver Incentive Program',
    'A web app used to reward good truck driving behavior via a point-based system.'
);