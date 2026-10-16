const router = require("express").Router();
const { createUser } = require("./user.controller");
const { validateCreateUser } = require("./user.validator");

// POST /api/users  Create a permitted child user
router.post("/", validateCreateUser, createUser);

module.exports = router;
