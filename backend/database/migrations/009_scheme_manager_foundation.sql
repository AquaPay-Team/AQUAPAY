
USE fintech_kyc;

CREATE TABLE schemes (
    
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    status TINYINT UNSIGNED NOT NULL DEFAULT 1,
    is_default TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_schemes_name (name),

    -- Allow only one default scheme.
    UNIQUE KEY uq_schemes_one_default (
        (CASE WHEN is_default = 1 THEN 1 ELSE NULL END)
    ),

    CONSTRAINT chk_schemes_status
        CHECK (status IN (0, 1)),

    CONSTRAINT chk_schemes_is_default
        CHECK (is_default IN (0, 1)),

    CONSTRAINT chk_schemes_default_active
        CHECK (is_default = 0 OR status = 1)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


INSERT INTO schemes (
    name,
    status,
    is_default
)
VALUES (
    'Default Scheme',
    1,
    1
);


ALTER TABLE users
    ADD COLUMN scheme_id BIGINT UNSIGNED NULL,

    ADD KEY idx_users_scheme_id (scheme_id),

    ADD CONSTRAINT fk_users_scheme
        FOREIGN KEY (scheme_id)
        REFERENCES schemes(id)
        ON DELETE RESTRICT;


CREATE TABLE user_scheme_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NOT NULL,

    previous_scheme_id BIGINT UNSIGNED DEFAULT NULL,

    new_scheme_id BIGINT UNSIGNED NOT NULL,

    actor_user_id BIGINT UNSIGNED DEFAULT NULL,

    change_source ENUM(
        'migration',
        'user_creation',
        'kyc_approval',
        'admin_profile'
    ) NOT NULL,

    reason VARCHAR(255) DEFAULT NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_scheme_assignments_user_time
        (user_id, created_at, id),

    KEY idx_scheme_assignments_actor
        (actor_user_id),

    KEY idx_scheme_assignments_previous
        (previous_scheme_id),

    KEY idx_scheme_assignments_new
        (new_scheme_id),

    CONSTRAINT fk_scheme_assignments_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_scheme_assignments_previous
        FOREIGN KEY (previous_scheme_id)
        REFERENCES schemes(id),

    CONSTRAINT fk_scheme_assignments_new
        FOREIGN KEY (new_scheme_id)
        REFERENCES schemes(id),

    CONSTRAINT fk_scheme_assignments_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES users(id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

START TRANSACTION;

UPDATE users u
JOIN schemes s
    ON s.is_default = 1
    AND s.status = 1
SET u.scheme_id = s.id
WHERE u.scheme_id IS NULL;

INSERT INTO user_scheme_assignments (
    user_id,
    previous_scheme_id,
    new_scheme_id,
    actor_user_id,
    change_source,
    reason
)
SELECT
    u.id,
    NULL,
    u.scheme_id,
    NULL,
    'migration',
    'Initial Default Scheme assignment'
FROM users u
WHERE u.scheme_id IS NOT NULL;

COMMIT;
