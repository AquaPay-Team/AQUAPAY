import { Router } from "express";
import * as controller from "./user.controller.js";
import { validateCreateUser } from "./user.validator.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();


router.post("/", requireAuth, validateCreateUser, controller.createUser);

export { router };
export default router;
