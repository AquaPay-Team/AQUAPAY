import { Router } from "express";
import statusRoutes from "./status/status.routes.js";
import basicDetailsRoutes from "./basic-details/basicDetails.routes.js";

const router = Router();

router.use(statusRoutes);
router.use(basicDetailsRoutes);

export { router };
export default router;
