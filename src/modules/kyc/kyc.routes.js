import { Router } from "express";
import basicDetailsRoutes from "./basic-details/basicDetails.routes.js";
import statusRoutes from "./status/status.routes.js";

const router = Router();

router.use(basicDetailsRoutes);
router.use(statusRoutes);

export { router };
export default router;
