const router = require("express").Router();

const userController = require("./user.controller");
const { validateCreateUser } = require("./user.validator");
const { requireAuth } = require("../../middlewares/auth.middleware");

// Create a user
router.post("/", requireAuth, validateCreateUser, userController.createUser);

module.exports = router;

