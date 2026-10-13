const express = require("express");
const healthRoutes = require("./routes/health.routes");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(express.json());
app.use("/api/health", healthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
