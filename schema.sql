-- CREATE DATABASE IF NOT EXISTS tcg_pos;
-- USE tcg_pos;

-- Users table (includes admin and salesperson roles)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'salesperson') NOT NULL DEFAULT 'salesperson',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cards inventory table
CREATE TABLE IF NOT EXISTS cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  card_number VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  rarity VARCHAR(100) NOT NULL,
  language VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  card_condition VARCHAR(50) NOT NULL, -- e.g., Near Mint, Lightly Played, etc.
  image_url VARCHAR(255) DEFAULT NULL,
  image_data LONGBLOB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales transactions table
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  salesperson_id INT NOT NULL,
  quantity INT NOT NULL,
  discount_type ENUM('none', 'percentage', 'fixed') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('cash', 'transfer', 'qr') NOT NULL DEFAULT 'cash',
  sale_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE CASCADE
);
