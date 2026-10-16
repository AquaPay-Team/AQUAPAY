
-- AQUAPAY role and hierarchy seed data


USE fintech_kyc;

-- Seed the eight roles with their agreed IDs and slugs.
INSERT INTO roles (id, name, slug) VALUES
  (1, 'Admin', 'AD'),
  (2, 'Sub Admin', 'SA'),
  (3, 'NSM', 'NSM'),
  (4, 'SH', 'SH'),
  (5, 'CNF', 'CNF'),
  (6, 'Master Distributor', 'MD'),
  (7, 'Distributor', 'DT'),
  (8, 'Retailer', 'RT')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug);

-- Define the allowed direct parent-child role relationships.
INSERT INTO role_hierarchy (parent_role_id, child_role_id) VALUES
  (1, 2),
  (2, 3),
  (3, 4),
  (4, 5),
  (5, 6),
  (6, 7),
  (7, 8)
ON DUPLICATE KEY UPDATE
  child_role_id = VALUES(child_role_id);
