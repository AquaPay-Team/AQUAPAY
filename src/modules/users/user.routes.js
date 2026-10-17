const router = require("express").Router();

const userController = require("./user.controller");
const {
  validateCreateUser,
  validateListUsers,
  validateUserIdParam,
  validateUpdateUser,
  validateUpdateStatus,
} = require("./user.validator");

const { requireAuth } = require("../../middlewares/auth.middleware");

router.post("/", requireAuth, validateCreateUser, userController.createUser);

router.get("/", requireAuth, validateListUsers, userController.listUsers);

router.get("/:id", requireAuth, validateUserIdParam, userController.getUser);

router.put(
  "/:id",
  requireAuth,
  validateUserIdParam,
  validateUpdateUser,
  userController.updateUser,
);

// Update user status
router.patch(
  "/:id/status",
  requireAuth,
  validateUserIdParam,
  validateUpdateStatus,
  userController.updateUserStatus,
);

// Delete a user
router.delete(
  "/:id",
  requireAuth,
  validateUserIdParam,
  userController.deleteUser,
);

module.exports = router;
