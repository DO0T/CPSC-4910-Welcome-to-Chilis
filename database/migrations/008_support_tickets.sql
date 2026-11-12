CREATE TABLE SupportTickets (
  ticket_id INT AUTO_INCREMENT PRIMARY KEY,
  requester_id INT NOT NULL,
  subject VARCHAR(160) NOT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  acknowledgement_sent BOOLEAN NOT NULL DEFAULT FALSE,
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX support_requester (requester_id, updated_at),
  FOREIGN KEY (requester_id) REFERENCES Users(user_id)
);

CREATE TABLE SupportMessages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  author_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX support_conversation (ticket_id, message_id),
  FOREIGN KEY (ticket_id) REFERENCES SupportTickets(ticket_id),
  FOREIGN KEY (author_id) REFERENCES Users(user_id)
);
