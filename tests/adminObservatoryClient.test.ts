import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminRequestOptions,
  createAdminObservatoryClient,
  createAdminObservatoryEndpoint,
} from "../src/app/services/adminObservatoryClient";

test("admin observatory endpoints include compact query strings", () => {
  assert.equal(
    createAdminObservatoryEndpoint("/admin/recommendations/requests", {
      limit: 25,
      offset: 50,
      status: "completed",
      userId: "",
    }),
    "/admin/recommendations/requests?limit=25&offset=50&status=completed",
  );
});

test("admin observatory client sends X-Admin-Token without user auth", async () => {
  const calls: Array<{ endpoint: string; headers?: Record<string, string>; auth?: boolean }> = [];
  const client = createAdminObservatoryClient(
    async <T>(endpoint: string, options: AdminRequestOptions) => {
      calls.push({
        endpoint,
        headers: options.headers,
        auth: options.auth,
      });

      return { ok: true } as T;
    },
    () => "  admin-token  ",
  );

  await client.getRecommendationRequest("request-1");
  await client.listDiscoveryJobs({ limit: 10, status: "PENDING" });

  assert.deepEqual(calls, [
    {
      endpoint: "/admin/recommendations/requests/request-1",
      headers: { "X-Admin-Token": "admin-token" },
      auth: false,
    },
    {
      endpoint: "/admin/discovery/jobs?limit=10&status=PENDING",
      headers: { "X-Admin-Token": "admin-token" },
      auth: false,
    },
  ]);
});
