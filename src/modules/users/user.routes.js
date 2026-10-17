
const router = require("express").Router();
const { createUser } = require("./user.controller");
const { validateCreateUser } = require("./user.validator");
const { requireAuth } = require("../../middlewares/auth.middleware");

// POST /api/users - Create a permitted child user
router.post("/", requireAuth, validateCreateUser, createUser);

module.exports = router;
