import redisConnection from "../../../config/redis.js";

const KYC_OTP_PREFIX = "aquapay:kyc:step1";

const ISSUE_CHALLENGE_SCRIPT = `
local cooldownTtl = redis.call('PTTL', KEYS[2])
if cooldownTtl > 0 then
  return {0, 'COOLDOWN', tostring(math.ceil(cooldownTtl / 1000))}
end
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {0, 'COOLDOWN', '60'}
end

local function rateLimitWait(key, maximum)
  local count = tonumber(redis.call('GET', key) or '0')
  if count >= maximum then
    return math.max(1, tonumber(redis.call('TTL', key) or '1'))
  end
  return nil
end

local userWait = rateLimitWait(KEYS[3], tonumber(ARGV[7]))
local ipWait = rateLimitWait(KEYS[4], tonumber(ARGV[8]))
if userWait or ipWait then
  return {0, 'RATE_LIMITED', tostring(math.max(userWait or 0, ipWait or 0))}
end

local userCount = redis.call('INCR', KEYS[3])
if userCount == 1 then redis.call('EXPIRE', KEYS[3], tonumber(ARGV[9])) end
local ipCount = redis.call('INCR', KEYS[4])
if ipCount == 1 then redis.call('EXPIRE', KEYS[4], tonumber(ARGV[9])) end

redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1],
  'challenge_id', ARGV[1],
  'user_id', ARGV[2],
  'case_id', ARGV[3],
  'step_number', ARGV[4],
  'otp_hash', ARGV[5],
  'details_fingerprint', ARGV[6],
  'attempts', '0',
  'state', 'active',
  'created_at', tostring(redis.call('TIME')[1]))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[11]))
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[10]))
return {1, 'ISSUED'}
`;

const CLAIM_CHALLENGE_SCRIPT = `
local function rateLimitWait(key, maximum)
  local count = tonumber(redis.call('GET', key) or '0')
  if count >= maximum then
    return math.max(1, tonumber(redis.call('TTL', key) or '1'))
  end
  return nil
end

local userWait = rateLimitWait(KEYS[2], tonumber(ARGV[8]))
local ipWait = rateLimitWait(KEYS[3], tonumber(ARGV[9]))
if userWait or ipWait then
  return {0, 'RATE_LIMITED', tostring(math.max(userWait or 0, ipWait or 0))}
end

local userCount = redis.call('INCR', KEYS[2])
if userCount == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[10])) end
local ipCount = redis.call('INCR', KEYS[3])
if ipCount == 1 then redis.call('EXPIRE', KEYS[3], tonumber(ARGV[10])) end

if redis.call('EXISTS', KEYS[1]) == 0 then return {0, 'INVALID'} end
if redis.call('HGET', KEYS[1], 'user_id') ~= ARGV[1]
  or redis.call('HGET', KEYS[1], 'case_id') ~= ARGV[2]
  or redis.call('HGET', KEYS[1], 'step_number') ~= ARGV[3] then
  return {0, 'INVALID'}
end

if redis.call('HGET', KEYS[1], 'details_fingerprint') ~= ARGV[4] then
  redis.call('HSET', KEYS[1], 'state', 'superseded')
  redis.call('HDEL', KEYS[1], 'otp_hash')
  return {0, 'INVALID'}
end

local now = tonumber(redis.call('TIME')[1])
local state = redis.call('HGET', KEYS[1], 'state')
if state == 'verifying' then
  local leaseUntil = tonumber(redis.call('HGET', KEYS[1], 'lease_until') or '0')
  if leaseUntil > now then return {0, 'INVALID'} end
  redis.call('HSET', KEYS[1], 'state', 'active')
  redis.call('HDEL', KEYS[1], 'claim_id', 'lease_until')
  state = 'active'
end
if state ~= 'active' then return {0, 'INVALID'} end

local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
if attempts >= tonumber(ARGV[6]) then
  redis.call('HSET', KEYS[1], 'state', 'locked')
  redis.call('HDEL', KEYS[1], 'otp_hash')
  return {0, 'INVALID'}
end

attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
local storedHash = redis.call('HGET', KEYS[1], 'otp_hash')
if not storedHash then return {0, 'INVALID'} end
redis.call('HSET', KEYS[1],
  'state', 'verifying',
  'claim_id', ARGV[5],
  'lease_until', tostring(now + tonumber(ARGV[7])))
return {1, 'CLAIMED', storedHash}
`;

const REJECT_CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0
  or redis.call('HGET', KEYS[1], 'user_id') ~= ARGV[1]
  or redis.call('HGET', KEYS[1], 'case_id') ~= ARGV[2]
  or redis.call('HGET', KEYS[1], 'step_number') ~= ARGV[3]
  or redis.call('HGET', KEYS[1], 'state') ~= 'verifying'
  or redis.call('HGET', KEYS[1], 'claim_id') ~= ARGV[4] then
  return 0
end
local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
if attempts >= tonumber(ARGV[5]) then
  redis.call('HSET', KEYS[1], 'state', 'locked')
  redis.call('HDEL', KEYS[1], 'otp_hash')
else
  redis.call('HSET', KEYS[1], 'state', 'active')
end
redis.call('HDEL', KEYS[1], 'claim_id', 'lease_until')
return 1
`;

const RELEASE_CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0
  or redis.call('HGET', KEYS[1], 'user_id') ~= ARGV[1]
  or redis.call('HGET', KEYS[1], 'case_id') ~= ARGV[2]
  or redis.call('HGET', KEYS[1], 'step_number') ~= ARGV[3]
  or redis.call('HGET', KEYS[1], 'state') ~= 'verifying'
  or redis.call('HGET', KEYS[1], 'claim_id') ~= ARGV[4] then
  return 0
end
redis.call('HINCRBY', KEYS[1], 'attempts', -1)
redis.call('HSET', KEYS[1], 'state', 'active')
redis.call('HDEL', KEYS[1], 'claim_id', 'lease_until')
return 1
`;

const CONSUME_CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0
  or redis.call('HGET', KEYS[1], 'user_id') ~= ARGV[1]
  or redis.call('HGET', KEYS[1], 'case_id') ~= ARGV[2]
  or redis.call('HGET', KEYS[1], 'step_number') ~= ARGV[3]
  or redis.call('HGET', KEYS[1], 'state') ~= 'verifying'
  or redis.call('HGET', KEYS[1], 'claim_id') ~= ARGV[4] then
  return 0
end
redis.call('HSET', KEYS[1], 'state', 'consumed')
redis.call('HDEL', KEYS[1], 'otp_hash', 'claim_id', 'lease_until')
return 1
`;

const DISCARD_CHALLENGE_SCRIPT = `
if redis.call('HGET', KEYS[1], 'challenge_id') == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const INVALIDATE_CHALLENGE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0
  or redis.call('HGET', KEYS[1], 'user_id') ~= ARGV[1]
  or redis.call('HGET', KEYS[1], 'case_id') ~= ARGV[2]
  or redis.call('HGET', KEYS[1], 'step_number') ~= ARGV[3] then
  return 0
end
return redis.call('DEL', KEYS[1])
`;

function challengeKey(caseId, stepNumber) {
  return `${KYC_OTP_PREFIX}:challenge:${caseId}:${stepNumber}`;
}

function cooldownKey(caseId, stepNumber) {
  return `${KYC_OTP_PREFIX}:cooldown:${caseId}:${stepNumber}`;
}

function rateKey(kind, scopeHash) {
  return `${KYC_OTP_PREFIX}:rate:${kind}:${scopeHash}`;
}

function scriptStatus(result) {
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Unexpected Redis script response");
  }
  return {
    accepted: Number(result[0]) === 1,
    code: String(result[1]),
    retryAfter: Number(result[2] || 0),
  };
}

async function issueChallenge({
  userId,
  caseId,
  stepNumber,
  otpHash,
  detailsFingerprint,
  challengeId,
  userRateHash,
  ipRateHash,
}) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(ISSUE_CHALLENGE_SCRIPT, {
    keys: [
      challengeKey(caseId, stepNumber),
      cooldownKey(caseId, stepNumber),
      rateKey("request:user", userRateHash),
      rateKey("request:ip", ipRateHash),
    ],
    arguments: [
      String(challengeId),
      String(userId),
      String(caseId),
      String(stepNumber),
      String(otpHash),
      String(detailsFingerprint),
      "5",
      "20",
      "900",
      "60",
      "300",
    ],
  });
  const status = scriptStatus(result);
  if (status.accepted) return { status: "issued" };
  return {
    status: status.code === "COOLDOWN" ? "cooldown" : "rate_limited",
    retryAfter: status.retryAfter,
  };
}

async function claimChallenge({
  userId,
  caseId,
  stepNumber,
  detailsFingerprint,
  claimId,
  userRateHash,
  ipRateHash,
}) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(CLAIM_CHALLENGE_SCRIPT, {
    keys: [
      challengeKey(caseId, stepNumber),
      rateKey("verify:user", userRateHash),
      rateKey("verify:ip", ipRateHash),
    ],
    arguments: [
      String(userId),
      String(caseId),
      String(stepNumber),
      String(detailsFingerprint),
      String(claimId),
      "5",
      "30",
      "10",
      "60",
      "900",
    ],
  });
  const status = scriptStatus(result);
  if (status.accepted) {
    return { status: "claimed", otpHash: String(result[2]) };
  }
  if (status.code === "RATE_LIMITED") {
    return { status: "rate_limited", retryAfter: status.retryAfter };
  }
  return { status: "invalid" };
}

async function rejectClaim({ userId, caseId, stepNumber, claimId }) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(REJECT_CLAIM_SCRIPT, {
    keys: [challengeKey(caseId, stepNumber)],
    arguments: [String(userId), String(caseId), String(stepNumber), String(claimId), "5"],
  });
  return Number(result) === 1;
}

async function releaseClaim({ userId, caseId, stepNumber, claimId }) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(RELEASE_CLAIM_SCRIPT, {
    keys: [challengeKey(caseId, stepNumber)],
    arguments: [String(userId), String(caseId), String(stepNumber), String(claimId)],
  });
  return Number(result) === 1;
}

async function consumeClaim({ userId, caseId, stepNumber, claimId }) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(CONSUME_CLAIM_SCRIPT, {
    keys: [challengeKey(caseId, stepNumber)],
    arguments: [String(userId), String(caseId), String(stepNumber), String(claimId)],
  });
  return Number(result) === 1;
}

async function discardChallenge({ caseId, stepNumber, challengeId }) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(DISCARD_CHALLENGE_SCRIPT, {
    keys: [challengeKey(caseId, stepNumber)],
    arguments: [String(challengeId)],
  });
  return Number(result) === 1;
}

async function invalidateChallenge({ userId, caseId, stepNumber }) {
  const client = await redisConnection.getRedisClient();
  const result = await client.eval(INVALIDATE_CHALLENGE_SCRIPT, {
    keys: [challengeKey(caseId, stepNumber)],
    arguments: [String(userId), String(caseId), String(stepNumber)],
  });
  return Number(result) === 1;
}

const kycOtpStore = {
  issueChallenge,
  claimChallenge,
  rejectClaim,
  releaseClaim,
  consumeClaim,
  discardChallenge,
  invalidateChallenge,
};

export {
  issueChallenge,
  claimChallenge,
  rejectClaim,
  releaseClaim,
  consumeClaim,
  discardChallenge,
  invalidateChallenge,
};
export default kycOtpStore;
