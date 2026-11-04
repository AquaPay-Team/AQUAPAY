import assert from "node:assert/strict";
import { test } from "node:test";
import { start } from "./server.js";

test("application startup rejects development signature bypass in production", async () => {
  const names = [
    "NODE_ENV",
    "IDTO_PROVIDER_MODE",
    "IDTO_SKIP_XML_SIGNATURE_VERIFICATION",
    "IDTO_DEV_UNVERIFIED_DATABASE",
    "DB_HOST",
    "DB_NAME",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const previousExitCode = process.exitCode;
  Object.assign(process.env, {
    NODE_ENV: "production",
    IDTO_PROVIDER_MODE: "idto",
    IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
    IDTO_DEV_UNVERIFIED_DATABASE: "true",
    DB_HOST: "127.0.0.1",
    DB_NAME: "fintech_kyc",
  });

  try {
    assert.equal(await start(), null);
    assert.equal(process.exitCode, 1);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    process.exitCode = previousExitCode;
  }
});
