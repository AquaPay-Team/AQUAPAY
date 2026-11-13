
-- AQUAPAY initial database schema
-- Intended for a fresh database setup only.
-- Do not run against an existing database without reviewing its schema.

CREATE DATABASE IF NOT EXISTS fintech_kyc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE fintech_kyc;

CREATE TABLE IF NOT EXISTS roles (
  id TINYINT UNSIGNED NOT NULL,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(10) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name),
  UNIQUE KEY slug (slug)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  company_id BIGINT UNSIGNED DEFAULT NULL,
  role_id TINYINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED DEFAULT NULL,
  shopname VARCHAR(150) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  pincode VARCHAR(10) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'blocked')
    NOT NULL DEFAULT 'active',
  admin_singleton TINYINT
    GENERATED ALWAYS AS (
      CASE WHEN role_id = 1 THEN 1 ELSE NULL END
    ) STORED,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY mobile (mobile),
  UNIQUE KEY admin_singleton (admin_singleton),
  KEY idx_users_parent_id (parent_id),
  KEY idx_users_role_id (role_id),
  KEY idx_users_company_id (company_id),
  CONSTRAINT fk_users_company
    FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_parent
    FOREIGN KEY (parent_id) REFERENCES users(id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS role_hierarchy (
  parent_role_id TINYINT UNSIGNED NOT NULL,
  child_role_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (parent_role_id, child_role_id),
  KEY child_role_id (child_role_id),
  CONSTRAINT fk_role_hierarchy_parent
    FOREIGN KEY (parent_role_id) REFERENCES roles(id),
  CONSTRAINT fk_role_hierarchy_child
    FOREIGN KEY (child_role_id) REFERENCES roles(id),
  CONSTRAINT chk_role_hierarchy_not_self
    CHECK (parent_role_id <> child_role_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
