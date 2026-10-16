const express = require("express");

const healthRoutes = require("./routes/health.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const userRoutes = require("./modules/users/user.routes");
const authRoutes = require("./modules/auth/auth.routes");

const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(express.json({ limit: "16kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
