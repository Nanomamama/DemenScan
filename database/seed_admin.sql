USE demenscan;

INSERT INTO admins (username, password_hash, display_name, role, is_active)
VALUES (
  'admin',
  '$2y$12$fzR7Qe4cRRK9rUgHVkHHBOzsQHxDm02T4pZPOGAS4FLstKuOXxsyC',
  'DemenScan Admin',
  'super_admin',
  1
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  role = VALUES(role),
  is_active = VALUES(is_active);

