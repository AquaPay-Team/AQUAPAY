import redisConnection from "../../config/redis.js";

/**
 * Best-effort session/auth cache invalidation.
 *
 * Sessions are primarily invalidated by the users.token_version generation
 * counter (see migration 011), which is authoritative across processes. This
 * module additionally clears short-lived Redis auth entries and keeps a local
 * blocked-user marker so an account deactivated by an admin is rejected with
 * the blocked-account response immediately, even before the next DB read.
 */

const CACHE_KEY_PREFIXES = ["auth:state:", "auth:user:", "auth:session:"];
const blockedUsers = new Set();

function userIdKey(userId) {
  return String(userId);
}

function markAccountBlocked(userId) {
  blockedUsers.add(userIdKey(userId));
}

function clearAccountBlocked(userId) {
  blockedUsers.delete(userIdKey(userId));
}

function isAccountMarkedBlocked(userId) {
  return blockedUsers.has(userIdKey(userId));
}

async function clearCachedAuthState(userId) {
  clearAccountBlocked(userId);

  try {
    const client = await redisConnection.getRedisClient();
    const keys = CACHE_KEY_PREFIXES.map((prefix) => `${prefix}${userId}`);
    await client.del(keys);
    // Also clear any wildcard session keys this account may have.
    const sessionKeys = await client.keys(`auth:session:${userId}:*`);
    if (sessionKeys.length) await client.del(sessionKeys);
  } catch {
    // Redis is optional — the DB token_version remains authoritative.
  }
}

export {
  markAccountBlocked,
  clearAccountBlocked,
  isAccountMarkedBlocked,
  clearCachedAuthState,
};

export default {
  markAccountBlocked,
  clearAccountBlocked,
  isAccountMarkedBlocked,
  clearCachedAuthState,
};
