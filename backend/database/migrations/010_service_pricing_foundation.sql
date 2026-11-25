-- AquaPay Phase 3: service catalogue and scheme pricing configuration.
-- Configuration only. No service/rate seeds and no financial posting.
-- Developers register supported services, products and methods;
-- authorized Admin APIs manage scheme-specific availability and pricing.
-- Apply after 009 using the existing migration runner.
USE fintech_kyc;

-- 1. Dynamic service catalogue (Pay-in, DMT, BBPS, etc.).
CREATE TABLE services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    status TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_services_code (code),
    CONSTRAINT chk_services_status CHECK (status IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Provider products. A service without product tiers can use a single
-- explicitly configured product; no special product is automatically seeded.
CREATE TABLE service_products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id BIGINT UNSIGNED NOT NULL,
    provider_code VARCHAR(64) NOT NULL,
    product_code VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    status TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_product (service_id, provider_code, product_code),
    UNIQUE KEY uq_product_id_service (id, service_id),
    KEY idx_products_service_status (service_id, status),
    CONSTRAINT fk_product_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT chk_product_status CHECK (status IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Product-specific payment methods/operators/operations.
-- DMT account verification and money transfer are distinct operations.
-- Amount ranges are pricing slabs, NOT text-only method codes.
CREATE TABLE service_methods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    status TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_method (product_id, code),
    UNIQUE KEY uq_method_id_service (id, service_id),
    KEY idx_methods_product_service (product_id, service_id),
    CONSTRAINT fk_method_product_service FOREIGN KEY (product_id, service_id)
        REFERENCES service_products (id, service_id) ON DELETE RESTRICT,
    CONSTRAINT chk_method_status CHECK (status IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Scheme-specific service availability.
-- Absent row or disabled row means unavailable; no automatic inheritance.
CREATE TABLE scheme_services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_scheme_service (scheme_id, service_id),
    UNIQUE KEY uq_ss_id_service (id, service_id),
    KEY idx_ss_service (service_id),
    CONSTRAINT fk_ss_scheme FOREIGN KEY (scheme_id)
        REFERENCES schemes (id) ON DELETE RESTRICT,
    CONSTRAINT fk_ss_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT chk_ss_enabled CHECK (is_enabled IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Scheme-specific method pricing header.
-- Composite foreign keys enforce that the scheme service and method
-- belong to the same service. A product's methods can differ freely.
CREATE TABLE scheme_method_rates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_service_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    service_method_id BIGINT UNSIGNED NOT NULL,
    pricing_mode ENUM('standard', 'slab') NOT NULL DEFAULT 'standard',
    is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_scheme_method (scheme_service_id, service_method_id),
    UNIQUE KEY uq_rate_id_ss (id, scheme_service_id),
    KEY idx_rate_ss_service (scheme_service_id, service_id),
    KEY idx_rate_method_service (service_method_id, service_id),
    CONSTRAINT fk_rate_scheme_service FOREIGN KEY (scheme_service_id, service_id)
        REFERENCES scheme_services (id, service_id) ON DELETE RESTRICT,
    CONSTRAINT fk_rate_method_service FOREIGN KEY (service_method_id, service_id)
        REFERENCES service_methods (id, service_id) ON DELETE RESTRICT,
    CONSTRAINT chk_rate_enabled CHECK (is_enabled IN (0, 1)),
    CONSTRAINT chk_rate_revision CHECK (revision >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Pricing rows, INR amount bounds [min_amount, max_amount).
-- NULL max_amount means no upper bound. Standard pricing has exactly one
-- enabled row with min_amount=0 and max_amount=NULL (including fixed operations).
-- Slab pricing has non-overlapping enabled ranges. The future write API
-- MUST lock the pricing header, validate the complete set of ranges and
-- update its revision/audit in the same transaction. CHECK and UNIQUE alone
-- cannot enforce non-overlap or the number of rows across a pricing header.
-- Missing/ambiguous matches must fail closed, not become zero-cost pricing.
CREATE TABLE scheme_rate_slabs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_method_rate_id BIGINT UNSIGNED NOT NULL,
    min_amount DECIMAL(18,2) NOT NULL,
    max_amount DECIMAL(18,2) DEFAULT NULL,
    service_charge_type ENUM('flat', 'percent') NOT NULL,
    service_charge_value DECIMAL(18,6) NOT NULL,
    discount_type ENUM('flat', 'percent') DEFAULT NULL,
    discount_value DECIMAL(18,6) DEFAULT NULL,
    instant_charge_type ENUM('flat', 'percent') DEFAULT NULL,
    instant_charge_value DECIMAL(18,6) DEFAULT NULL,
    is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slab_rate_min (scheme_method_rate_id, min_amount),
    KEY idx_slab_match (scheme_method_rate_id, is_enabled, min_amount, max_amount),
    CONSTRAINT fk_slab_rate FOREIGN KEY (scheme_method_rate_id)
        REFERENCES scheme_method_rates (id) ON DELETE RESTRICT,
    CONSTRAINT chk_slab_range CHECK (
        min_amount >= 0 AND (max_amount IS NULL OR max_amount > min_amount)
    ),
    CONSTRAINT chk_slab_enabled CHECK (is_enabled IN (0, 1)),
    CONSTRAINT chk_slab_service_charge CHECK (
        service_charge_value >= 0 AND
        (service_charge_type = 'flat' OR service_charge_value <= 100)
    ),
    CONSTRAINT chk_slab_discount CHECK (
        (discount_type IS NULL AND discount_value IS NULL) OR
        (discount_type IS NOT NULL AND discount_value IS NOT NULL AND
         discount_value >= 0 AND (discount_type = 'flat' OR discount_value <= 100))
    ),
    CONSTRAINT chk_slab_instant_charge CHECK (
        (instant_charge_type IS NULL AND instant_charge_value IS NULL) OR
        (instant_charge_type IS NOT NULL AND instant_charge_value IS NOT NULL AND
         instant_charge_value >= 0 AND
         (instant_charge_type = 'flat' OR instant_charge_value <= 100))
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Each pricing row has independent role-wise commission values.
-- No recipient or payout is implied by this configuration; actual eligibility
-- is resolved through users.parent_id by the future calculation engine.
CREATE TABLE scheme_role_commissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_rate_slab_id BIGINT UNSIGNED NOT NULL,
    role_id TINYINT UNSIGNED NOT NULL,
    commission_type ENUM('flat', 'percent') NOT NULL,
    commission_value DECIMAL(18,6) NOT NULL,
    is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slab_role (scheme_rate_slab_id, role_id),
    KEY idx_commission_role (role_id),
    CONSTRAINT fk_commission_slab FOREIGN KEY (scheme_rate_slab_id)
        REFERENCES scheme_rate_slabs (id) ON DELETE RESTRICT,
    CONSTRAINT fk_commission_role FOREIGN KEY (role_id)
        REFERENCES roles (id) ON DELETE RESTRICT,
    CONSTRAINT chk_commission_enabled CHECK (is_enabled IN (0, 1)),
    CONSTRAINT chk_commission_value CHECK (
        commission_value >= 0 AND
        (commission_type = 'flat' OR commission_value <= 100)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. Scheme pricing audit. Future write APIs insert complete before/after
-- snapshots (including slabs and role rates) atomically with changes.
-- NULL method rate permits service-level audit events. A non-NULL rate must
-- belong to the same scheme_service_id, enforced by the composite FK.
CREATE TABLE scheme_rate_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_service_id BIGINT UNSIGNED NOT NULL,
    scheme_method_rate_id BIGINT UNSIGNED DEFAULT NULL,
    actor_user_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(40) NOT NULL,
    before_state JSON DEFAULT NULL,
    after_state JSON NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_audit_ss_time (scheme_service_id, created_at, id),
    KEY idx_audit_rate_ss (scheme_method_rate_id, scheme_service_id),
    KEY idx_audit_rate_time (scheme_method_rate_id, created_at, id),
    KEY idx_audit_actor (actor_user_id),
    CONSTRAINT fk_audit_ss FOREIGN KEY (scheme_service_id)
        REFERENCES scheme_services (id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_rate_ss FOREIGN KEY (scheme_method_rate_id, scheme_service_id)
        REFERENCES scheme_method_rates (id, scheme_service_id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Extend the existing enum at the end, preserving all existing values.
-- This only enables the audit source. The transactional reassignment API
-- is a separate code change; no users are reassigned by this migration.
ALTER TABLE user_scheme_assignments
    MODIFY COLUMN change_source ENUM(
        'migration',
        'user_creation',
        'kyc_approval',
        'admin_profile',
        'scheme_deactivation'
    ) NOT NULL;
