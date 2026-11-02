import express from "express";
import helmet from "helmet";
import cors from "cors";

import healthRoutes from "./routes/health.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import kycRoutes from "./modules/kyc/kyc.routes.js";

import { notFound, errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "16kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
