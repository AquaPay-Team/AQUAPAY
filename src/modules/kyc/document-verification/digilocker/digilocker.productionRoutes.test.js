import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "production";
process.env.IDTO_PROVIDER_MODE = "idto";
process.env.IDTO_SKIP_XML_SIGNATURE_VERIFICATION = "false";

const { default: digilockerRoutes } = await import("./digilocker.routes.js");

test("real production KYC router does not register the mock authorization route", () => {
  const hasMockAuthorizationRoute = digilockerRoutes.stack.some(
    (layer) => layer.route?.path === "/digilocker/mock-authorize",
  );
  assert.equal(hasMockAuthorizationRoute, false);
});
