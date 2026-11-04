import getCloudinary from "../src/config/cloudinary.js";

console.log("Starting Cloudinary connection test...");

async function testCloudinaryConnection() {
  try {
    const cloudinary = getCloudinary();
    console.log("Cloudinary configuration loaded.");

    await cloudinary.api.ping();

    console.log("Cloudinary connected successfully!");
  } catch (error) {
    // Never log raw provider errors or request configuration.
    console.error("Cloudinary connection failed.");
    console.error("Error type:", error?.name || "UnknownError");

    if (
      typeof error?.http_code === "number" &&
      Number.isInteger(error.http_code)
    ) {
      console.error("HTTP status:", error.http_code);
    }

    if (
      typeof error?.error?.message === "string" &&
      !/api[_ -]?key|api[_ -]?secret|authorization|credential|token/i.test(
        error.error.message,
      )
    ) {
      console.error("Provider message:", error.error.message);
    }

    process.exitCode = 1;
  }
}

testCloudinaryConnection();
