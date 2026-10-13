USE fintech_kyc;

INSERT INTO roles (name, level) VALUES
  ('Admin', 1),
  ('Sub Admin', 2),
  ('NSM', 3),
  ('SH', 4),
  ('CNF', 5),
  ('Master Distributor', 6),
  ('Distributor', 7),
  ('Retailer', 8)
ON DUPLICATE KEY UPDATE level = VALUES(level);
