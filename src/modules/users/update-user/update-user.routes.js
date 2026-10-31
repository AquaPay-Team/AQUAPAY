
import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { validateUpdateUser } from "./update-user.validator.js";
import { updateUser } from "./update-user.controller.js";

const router = Router();

router.patch(
  "/:id",
  requireAuth,
  validateUpdateUser,
  updateUser,
);

export { router };
export default router;
