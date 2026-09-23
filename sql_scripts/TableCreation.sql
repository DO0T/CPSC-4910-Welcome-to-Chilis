DROP TABLE IF EXISTS SponsorUsers;
DROP TABLE IF EXISTS Drivers;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS AuditLog;

CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, 
    role ENUM('Driver', 'Sponsor', 'Admin') NOT NULL,
    profile_picture_url VARCHAR(2048) NULL
);

CREATE TABLE Sponsors (
    sponsor_id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    point_value DECIMAL(10, 2) DEFAULT 0.01 
);

CREATE TABLE SponsorUsers (
    user_id INT PRIMARY KEY,
    sponsor_id INT,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (sponsor_id) REFERENCES Sponsors(sponsor_id)
);

CREATE TABLE Drivers (
    user_id INT PRIMARY KEY,
    sponsor_id INT,
    total_points INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (sponsor_id) REFERENCES Sponsors(sponsor_id)
);

CREATE TABLE AuditLog (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    event_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(255), 
    event_category ENUM('Driver Application', 'Point Change', 'Password Change', 'Login Attempt') NOT NULL,
    status VARCHAR(50), 
    details TEXT 
);
