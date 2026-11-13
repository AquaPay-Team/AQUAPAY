import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

/**
 * Configures Cloudinary once and returns the Cloudinary instance.
 * Credentials are loaded from environment variables.
 */
function getCloudinary() {
  if (isConfigured) {
    return cloudinary;
  }

  const requiredEnvVariables = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  // Check whether required environment variables exist
  const missingVariables = requiredEnvVariables.filter(
    (variable) => !process.env[variable]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Cloudinary environment variables: ${missingVariables.join(", ")}`,
    );
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET.trim();

  // Prevent accidental use of placeholder credentials
  const credentials = [cloudName, apiKey, apiSecret];

  const hasPlaceholder = credentials.some((value) =>
    /replace|change.?me|placeholder|example/i.test(value),
  );

  if (hasPlaceholder) {
    throw new Error("Cloudinary credentials contain placeholder values.");
  }

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;

  return cloudinary;
}

export { getCloudinary };
export default getCloudinary;
