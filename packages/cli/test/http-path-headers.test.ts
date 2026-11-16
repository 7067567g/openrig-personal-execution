import { describe, expect, it } from "vitest";
import { pathHeaders } from "../src/http-path-headers.js";

describe("pathHeaders — filesystem paths as HTTP header values", () => {
  it("sends an ASCII path verbatim, with no encoding marker", () => {
    expect(pathHeaders({ "X-Rig-Root": "/tmp/project" })).toEqual({ "X-Rig-Root": "/tmp/project" });
  });

  it("percent-encodes a non-ASCII path and marks the request so the daemon decodes it", () => {
    const headers = pathHeaders({ "X-Rig-Root": "/home/下载/项目" });
    expect(headers["X-Path-Encoding"]).toBe("uri");
    expect(headers["X-Rig-Root"]).toBe("/home/%E4%B8%8B%E8%BD%BD/%E9%A1%B9%E7%9B%AE");
    expect(decodeURIComponent(headers["X-Rig-Root"]!)).toBe("/home/下载/项目");
  });

  it("encodes only the values that need it and still marks the request once", () => {
    const headers = pathHeaders({ "X-Rig-Root": "/tmp", "X-Cwd-Override": "/tmp/项目" });
    expect(headers["X-Rig-Root"]).toBe("/tmp");
    expect(headers["X-Path-Encoding"]).toBe("uri");
    expect(decodeURIComponent(headers["X-Cwd-Override"]!)).toBe("/tmp/项目");
  });

  it("skips absent paths instead of sending the string \"undefined\"", () => {
    expect(pathHeaders({ "X-Rig-Root": undefined })).toEqual({});
  });

  it("leaves a literal % in an ASCII path alone", () => {
    expect(pathHeaders({ "X-Rig-Root": "/tmp/100%" })).toEqual({ "X-Rig-Root": "/tmp/100%" });
  });
});
