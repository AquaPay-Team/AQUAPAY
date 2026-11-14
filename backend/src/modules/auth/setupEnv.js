// Test environment setup for auth tests
process.env.JWT_SECRET = "unit-test-secret-that-is-longer-than-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "1";
process.env.DB_USER = "unit_test_user";
process.env.DB_PASSWORD = "unit-test-only-password";
process.env.DB_NAME = "auth_unit_test_database";
process.env.AUTH_OTP_HMAC_SECRET = "unit-test-password-reset-hmac-secret-32-bytes";
process.env.AUTH_RATE_LIMIT_HMAC_SECRET = "unit-test-rate-limit-hmac-secret-32-bytes";
process.env.AUTH_ALLOW_DEVELOPMENT_SECRETS = "false";
