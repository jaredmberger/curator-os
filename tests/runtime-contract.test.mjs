import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/runtime.js";

test("CuratorOS runtime endpoint exposes contract v1", async () => {
  const response = await onRequestGet({
    env: {
      CF_PAGES_COMMIT_SHA: "abcdef1234567890",
      CF_PAGES_BRANCH: "main",
      CF_PAGES_URL: "https://example.pages.dev"
    }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.contractVersion, 1);
  assert.equal(body.service, "CuratorOS");
  assert.equal(body.repository, "jaredmberger/curator-os");
  assert.equal(body.productionBranch, "main");
  assert.equal(body.version, "1.0.0-rc.1");
  assert.equal(body.commit, "abcdef1234567890");
  assert.equal(body.cloudflareDeploymentId, null);
  assert.equal(body.runtime, "cloudflare-pages");
  assert.equal(body.build.source, "cloudflare-pages");
  assert.equal(body.deploymentUrl, "https://example.pages.dev");
  assert.match(body.observedAt, /^\d{4}-\d{2}-\d{2}T/);
});
