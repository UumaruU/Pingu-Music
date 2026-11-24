import test from "node:test";
import assert from "node:assert/strict";
import { getSidebarNavItems } from "../src/app/components/sidebarItems";

test("sidebar navigation exposes the internal recommendation observatory", () => {
  const routeIds: string[] = getSidebarNavItems()
    .map((item) => (item.route ? String(item.route) : undefined))
    .filter((route): route is string => Boolean(route));

  assert.equal(routeIds.includes("stream"), false);
  assert.deepEqual(routeIds, ["home", "favorites", "search", "history", "admin"]);
});
