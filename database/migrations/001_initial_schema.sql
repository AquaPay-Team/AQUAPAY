-- Initial schema proposal. Review business rules before applying.
CREATE DATABASE IF NOT EXISTS fintech_kyc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fintech_kyc;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL UNIQUE,
  level TINYINT UNSIGNED NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(160) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  state VARCHAR(100) NULL,
  city VARCHAR(100) NULL,
  password_hash VARCHAR(255) NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  parent_id BIGINT UNSIGNED NULL,
  status ENUM('pending', 'active', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_users_parent FOREIGN KEY (parent_id) REFERENCES users(id),
  INDEX idx_users_role (role_id),
  INDEX idx_users_company (company_id),
  INDEX idx_users_creator (created_by),
  INDEX idx_users_parent (parent_id)
);
