CREATE TABLE MessageConversations (
  conversation_id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  sender_role ENUM('Driver','Sponsor','Admin') NOT NULL,
  recipient_role ENUM('Driver','Sponsor','Admin') NOT NULL,
  subject VARCHAR(160) NOT NULL,
  driver_replies_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX messaging_sender (sender_id, updated_at),
  INDEX messaging_recipient (recipient_id, updated_at),
  FOREIGN KEY (sender_id) REFERENCES Users(user_id),
  FOREIGN KEY (recipient_id) REFERENCES Users(user_id)
);
CREATE TABLE ConversationMessages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  author_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX conversation_order (conversation_id, message_id),
  FOREIGN KEY (conversation_id) REFERENCES MessageConversations(conversation_id),
  FOREIGN KEY (author_id) REFERENCES Users(user_id)
);
CREATE TABLE MessageNotificationPreferences (
  user_id INT PRIMARY KEY,
  sponsor_messages_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);
