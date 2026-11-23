import { lazy } from "react";

/**
 * Enhanced React.lazy with automatic retry on chunk loading errors.
 * 
 * In Single Page Applications built with Vite, when a new build is deployed
 * or the local development server restarts, cached chunk URLs in the browser's
 * memory can fail with "Failed to fetch dynamically imported module".
 * 
 * This wrapper intercepts that network failure and performs a one-time automatic
 * page refresh to fetch the latest module graph seamlessly.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const hasAlreadyReloaded = JSON.parse(
      window.sessionStorage.getItem("aquapay_chunk_retry") || "false"
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem("aquapay_chunk_retry", "false");
      return component;
    } catch (error) {
      const isDynamicImportError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Importing a module script failed") ||
        error?.name === "ChunkLoadError";

      if (isDynamicImportError && !hasAlreadyReloaded) {
        window.sessionStorage.setItem("aquapay_chunk_retry", "true");
        window.location.reload();
        return new Promise(() => {});
      }

      throw error;
    }
  });
}

export default lazyWithRetry;
