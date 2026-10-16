const router = require("express").Router();
const userController = require("./user.controller");
const {
  validateCreateUser,
  validateListUsers,
  validateUserIdParam,
  validateUpdateUser,
  validateUpdateStatus
} = require("./user.validator");

// POST /api/users - Create a permitted child user
router.post("/", validateCreateUser, userController.createUser);

// GET /api/users - List users within caller's downline (with pagination & filters)
router.get("/", validateListUsers, userController.listUsers);

// GET /api/users/:id - Get a user within caller's downline
router.get("/:id", validateUserIdParam, userController.getUser);

// PUT /api/users/:id - Update profile fields (name, mobile, state, city)
router.put("/:id", validateUserIdParam, validateUpdateUser, userController.updateUser);

// PATCH /api/users/:id/status - Update account status (active, inactive, suspended)
router.patch("/:id/status", validateUserIdParam, validateUpdateStatus, userController.updateUserStatus);

// DELETE /api/users/:id - Delete a user within caller's downline
router.delete("/:id", validateUserIdParam, userController.deleteUser);

module.exports = router;
