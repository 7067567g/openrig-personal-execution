import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { pathHeader } from "../src/routes/path-headers.js";

function paths() {
  const app = new Hono();
  app.get("/", (c) => c.json({ root: pathHeader(c, "X-Rig-Root") ?? null, cwd: pathHeader(c, "X-Cwd-Override") ?? null }));
  return app;
}

async function read(headers: Record<string, string>) {
  const res = await paths().request("/", { headers });
  return (await res.json()) as { root: string | null; cwd: string | null };
}

describe("pathHeader — filesystem paths carried in request headers", () => {
  it("passes an ASCII path through unchanged and needs no marker (older CLI shape)", async () => {
    expect(await read({ "X-Rig-Root": "/tmp/project" })).toEqual({ root: "/tmp/project", cwd: null });
  });

  it("decodes a path the CLI percent-encoded because the request header value is a ByteString", async () => {
    const path = "/home/下载/deepseek/项目/10-openrig-deepseek";
    expect(await read({ "X-Rig-Root": encodeURIComponent(path), "X-Path-Encoding": "uri" })).toEqual({ root: path, cwd: null });
  });

  it("decodes both path headers of one request with one marker", async () => {
    const root = "/tmp/项目";
    const cwd = "/tmp/项目/relative/project";
    expect(await read({
      "X-Rig-Root": encodeURIComponent(root),
      "X-Cwd-Override": encodeURIComponent(cwd),
      "X-Path-Encoding": "uri",
    })).toEqual({ root, cwd });
  });

  it("returns a malformed escape unchanged, so the caller's own checks fail closed", async () => {
    expect(await read({ "X-Rig-Root": "/tmp/%E4", "X-Path-Encoding": "uri" })).toEqual({ root: "/tmp/%E4", cwd: null });
  });

  it("does not decode when the marker is absent, so a literal path with % is untouched", async () => {
    expect(await read({ "X-Rig-Root": "/tmp/100%25" })).toEqual({ root: "/tmp/100%25", cwd: null });
  });
});
