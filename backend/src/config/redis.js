import { createClient } from "redis";

let client;
let connectPromise;

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) throw new Error("REDIS_URL is not configured");

  const parsedUrl = new URL(redisUrl);
  if (parsedUrl.protocol !== "redis:" && parsedUrl.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }

  const redisClient = createClient({
    url: redisUrl,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) => (retries >= 3 ? false : 100 * (retries + 1)),
    },
  });

  // Do not include the error message because connection URLs can contain credentials.
  redisClient.on("error", () => {
    console.error("[AquaPay Redis] connection error");
  });
  return redisClient;
}

async function getRedisClient() {
  if (!client) client = createRedisClient();

  if (!client.isReady) {
    if (!client.isOpen) {
      if (!connectPromise) {
        const activeClient = client;
        connectPromise = activeClient.connect().finally(() => {
          if (client === activeClient) connectPromise = undefined;
        });
      }
      const activeClient = client;
      try {
        await connectPromise;
      } catch (error) {
        if (client === activeClient) {
          client = undefined;
          connectPromise = undefined;
          activeClient.destroy();
        }
        throw error;
      }
    } else if (connectPromise) {
      await connectPromise;
    }
  }

  if (!client.isReady) throw new Error("Redis is unavailable");
  return client;
}

async function closeRedisConnection() {
  if (!client) return;
  const activeClient = client;
  client = undefined;
  connectPromise = undefined;

  if (activeClient.isReady) {
    await activeClient.close();
  } else {
    activeClient.destroy();
  }
}

const redisConnection = { getRedisClient, closeRedisConnection };

export { getRedisClient, closeRedisConnection };
export default redisConnection;
