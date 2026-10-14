const express = require("express");
const healthRoutes = require("./routes/health.routes");
const userRoutes = require("./modules/users/user.routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(express.json());
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

