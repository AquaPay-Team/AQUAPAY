import express from "express";
import healthRoutes from "./routes/health.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import getUserRoutes from "./modules/users/get-user/get-user.routes.js";
import updateUserRoutes from "./modules/users/update-user/update-user.routes.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(express.json({ limit: "16kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/users", getUserRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", updateUserRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
