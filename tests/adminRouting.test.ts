import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, routeToHash } from "../src/app/hooks/useHashRoute";

test("hash routing supports recommendation observatory list and detail routes", () => {
  assert.deepEqual(parseRoute("#/admin/recommendations"), {
    page: "admin",
    adminSection: "recommendations",
  });
  assert.deepEqual(parseRoute("#/admin/recommendations/request-1"), {
    page: "admin",
    adminSection: "recommendations",
    adminRequestId: "request-1",
  });
  assert.equal(
    routeToHash({
      page: "admin",
      adminSection: "recommendations",
      adminRequestId: "request-1",
    }),
    "#/admin/recommendations/request-1",
  );
});
