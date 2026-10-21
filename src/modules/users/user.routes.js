import { Router } from "express";
import * as controller from "./user.controller.js";
import { validateCreateUser } from "./user.validator.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import getUserRoutes from "./get-user/get-user.routes.js";

const router = Router();

router.post("/", requireAuth, validateCreateUser, controller.createUser);
router.use("/", getUserRoutes);

export { router };
export default router;
