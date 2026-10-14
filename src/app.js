import express from "express";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";

const app = express();

app.use(express.json());
app.use("/api/health", healthRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
