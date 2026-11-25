import * as mediaModel from "./media.model.js";
import getCloudinary from "../../../config/cloudinary.js";

const POLL_INTERVAL_MS = 30 * 1000;

let timer = null;
let running = false;
let stopping = false;
let activePromise = null;

// Claim one cleanup job using a database transaction.
async function claimCleanupJob() {
  const connection = await mediaModel.getConnection();

  try {
    await connection.beginTransaction();

    const job = await mediaModel.claimNextMediaCleanupJob(connection);

    await connection.commit();

    return job;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Delete the Cloudinary asset.
async function deleteCloudinaryAsset(job) {
  if (job.storage_provider !== "cloudinary") {
    throw new Error("Unsupported media storage provider");
  }

  if (!["image", "video"].includes(job.resource_type)) {
    throw new Error("Invalid Cloudinary resource type");
  }

  if (!job.storage_key) {
    throw new Error("Missing Cloudinary public ID");
  }

  const cloudinary = getCloudinary();

  const result = await cloudinary.uploader.destroy(
    job.storage_key,
    {
      resource_type: job.resource_type,
      type: "authenticated",
      invalidate: true,
    },
  );

  // "not found" is also treated as success because deletion is idempotent.
  if (!["ok", "not found"].includes(result?.result)) {
    throw new Error(
      `Unexpected Cloudinary deletion result: ${result?.result}`,
    );
  }
}

// Mark a successfully deleted asset as completed.
async function completeCleanupJob(jobId) {
  const connection = await mediaModel.getConnection();

  try {
    await connection.beginTransaction();

    const completed =
      await mediaModel.markMediaCleanupCompleted(
        connection,
        jobId,
      );

    if (!completed) {
      throw new Error("Could not mark cleanup job as completed");
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Schedule a retry when Cloudinary deletion fails.
async function retryCleanupJob(jobId, error) {
  const connection = await mediaModel.getConnection();

  try {
    await connection.beginTransaction();

    await mediaModel.scheduleMediaCleanupRetry(
      connection,
      jobId,
      error?.message || "Unknown cleanup error",
    );

    await connection.commit();
  } catch (retryError) {
    await connection.rollback();
    console.error(
      "[AquaPay KYC Cleanup] Retry scheduling failed:",
      retryError,
    );
  } finally {
    connection.release();
  }
}

// Process one claimed cleanup job.
async function processCleanupJob(job) {
  try {
    await deleteCloudinaryAsset(job);
  } catch (error) {
    console.error(
      `[AquaPay KYC Cleanup] Cloudinary deletion failed for job ${job.id}:`,
      error,
    );

    await retryCleanupJob(job.id, error);
    return;
  }

  try {
    await completeCleanupJob(job.id);

    console.info(
      `[AquaPay KYC Cleanup] Job ${job.id} completed`,
    );
  } catch (error) {
    // The asset may already be deleted. The stale processing
    // job can be reclaimed later and safely retried.
    console.error(
      `[AquaPay KYC Cleanup] Completion update failed for job ${job.id}:`,
      error,
    );
  }
}

// Process available jobs sequentially.
async function runWorkerCycle() {
  if (running || stopping) return;

  running = true;

  try {
    while (!stopping) {
      const job = await claimCleanupJob();

      if (!job) break;

      await processCleanupJob(job);
    }
  } catch (error) {
    console.error(
      "[AquaPay KYC Cleanup] Worker cycle failed:",
      error,
    );
  } finally {
    running = false;
    activePromise = null;

    if (!stopping) {
      timer = setTimeout(() => {
        activePromise = runWorkerCycle();
      }, POLL_INTERVAL_MS);
    }
  }
}

// Start the worker.
export function startMediaCleanupWorker() {
  if (running || timer) return;

  stopping = false;

  console.info("[AquaPay KYC Cleanup] Worker started");

  activePromise = runWorkerCycle();
}

// Stop the worker and wait for an active cycle to finish.
export async function stopMediaCleanupWorker() {
  stopping = true;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (activePromise) {
    await activePromise;
  }

  console.info("[AquaPay KYC Cleanup] Worker stopped");
}
