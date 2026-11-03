import crypto from "node:crypto";
import redisConnection from "../../../../config/redis.js";

const STATE_PREFIX = "aquapay:kyc:digilocker:oauth-state";
const STATE_TTL_SECONDS = 600;

const CONSUME_STATE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if not value then
  return false
end

redis.call("DEL", KEYS[1])
return value
`;

function hashState(state) {
  return crypto.createHash("sha256").update(state).digest("hex");
}

function validateContext({
  userId,
  caseId,
  verificationId,
  authorizationSessionId,
  verificationType,
}) {
  if (!/^[1-9]\d*$/.test(String(userId))) {
    throw new Error("Invalid user ID");
  }

  if (!/^[1-9]\d*$/.test(String(caseId))) {
    throw new Error("Invalid KYC case ID");
  }

  if (!/^[1-9]\d*$/.test(String(verificationId))) {
    throw new Error("Invalid verification session ID");
  }

  if (
    typeof authorizationSessionId !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(authorizationSessionId)
  ) {
    throw new Error("Invalid authorization session ID");
  }

  if (!["aadhaar", "pan"].includes(verificationType)) {
    throw new Error("Invalid verification type");
  }
}

function createDigilockerStateStore({
  getRedisClient = redisConnection.getRedisClient,
  now = Date.now,
  ttlSeconds = STATE_TTL_SECONDS,
  env = process.env,
} = {}) {
  function assertSecureRedisTransport() {
    if (env.NODE_ENV !== "production") return;
    try {
      if (new URL(env.REDIS_URL).protocol !== "rediss:") {
        throw new Error("Production DigiLocker state requires Redis TLS");
      }
    } catch {
      throw new Error("Production DigiLocker state requires Redis TLS");
    }
  }

  async function createAuthorizationState(context) {
    validateContext(context);
    assertSecureRedisTransport();

    const state = crypto.randomBytes(32).toString("base64url");
    const key = `${STATE_PREFIX}:${hashState(state)}`;
    const payload = JSON.stringify({
      userId: String(context.userId),
      caseId: String(context.caseId),
      verificationId: String(context.verificationId),
      authorizationSessionId: context.authorizationSessionId,
      verificationType: context.verificationType,
      createdAt: now(),
    });
    const client = await getRedisClient();
    const result = await client.set(key, payload, {
      EX: ttlSeconds,
      NX: true,
    });

    if (result !== "OK") {
      throw new Error("Unable to create DigiLocker authorization state");
    }

    return { state, expiresIn: ttlSeconds };
  }

  async function consumeAuthorizationState(state) {
    assertSecureRedisTransport();
    if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
      return null;
    }

    const key = `${STATE_PREFIX}:${hashState(state)}`;
    const client = await getRedisClient();
    const result = await client.eval(CONSUME_STATE_SCRIPT, {
      keys: [key],
      arguments: [],
    });

    if (typeof result !== "string") return null;

    try {
      const payload = JSON.parse(result);
      validateContext(payload);

      if (
        !Number.isFinite(payload.createdAt) ||
        now() - payload.createdAt > ttlSeconds * 1000 ||
        payload.createdAt > now() + 5000
      ) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async function discardAuthorizationState(state) {
    assertSecureRedisTransport();
    if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
      return false;
    }
    const client = await getRedisClient();
    return Number(await client.del(`${STATE_PREFIX}:${hashState(state)}`)) === 1;
  }

  return {
    createAuthorizationState,
    consumeAuthorizationState,
    discardAuthorizationState,
  };
}

const defaultStore = createDigilockerStateStore();

export const createAuthorizationState = defaultStore.createAuthorizationState;
export const consumeAuthorizationState = defaultStore.consumeAuthorizationState;
export const discardAuthorizationState = defaultStore.discardAuthorizationState;
export { createDigilockerStateStore };

export default {
  createAuthorizationState,
  consumeAuthorizationState,
  discardAuthorizationState,
};
