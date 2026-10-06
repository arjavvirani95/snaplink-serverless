import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { beforeEach, describe, expect, it } from "vitest";
import { makeCreateHandler } from "../src/handlers/create.js";
import { makeRedirectHandler } from "../src/handlers/redirect.js";
import { makeStatsHandler } from "../src/handlers/stats.js";
import { InMemoryLinkRepo } from "../src/repo.js";

const event = (e: Partial<APIGatewayProxyEventV2>) => e as APIGatewayProxyEventV2;
const body = (r: unknown) => JSON.parse((r as APIGatewayProxyStructuredResultV2).body!);
const status = (r: unknown) => (r as APIGatewayProxyStructuredResultV2).statusCode;

let repo: InMemoryLinkRepo;
let create: ReturnType<typeof makeCreateHandler>;

beforeEach(() => {
  repo = new InMemoryLinkRepo();
  create = makeCreateHandler(repo, () => "https://sn.ap");
});

describe("create", () => {
  it("creates a random code", async () => {
    const res = await create(event({ body: JSON.stringify({ url: "https://example.com" }) }));
    expect(status(res)).toBe(201);
    expect(body(res).shortUrl).toMatch(/^https:\/\/sn\.ap\/[0-9A-Za-z]{7}$/);
  });

  it("supports custom aliases and rejects duplicates", async () => {
    const req = event({ body: JSON.stringify({ url: "https://example.com", alias: "launch" }) });
    expect(status(await create(req))).toBe(201);
    expect(status(await create(req))).toBe(409);
  });

  it("validates input", async () => {
    expect(status(await create(event({ body: "not json" })))).toBe(400);
    expect(status(await create(event({ body: JSON.stringify({ url: "javascript:x" }) })))).toBe(400);
    expect(status(await create(event({ body: JSON.stringify({ url: "https://a.com", expiresInDays: 999 }) })))).toBe(400);
  });

  it("decodes base64 bodies", async () => {
    const b64 = Buffer.from(JSON.stringify({ url: "https://example.com" })).toString("base64");
    expect(status(await create(event({ body: b64, isBase64Encoded: true })))).toBe(201);
  });
});

describe("redirect + stats", () => {
  it("redirects and counts clicks", async () => {
    await create(event({ body: JSON.stringify({ url: "https://example.com/x", alias: "demo" }) }));
    const redirect = makeRedirectHandler(repo);
    const res = (await redirect(event({ pathParameters: { code: "demo" } }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(302);
    expect(res.headers!.location).toBe("https://example.com/x");

    const stats = await makeStatsHandler(repo)(event({ pathParameters: { code: "demo" } }));
    expect(body(stats).clicks).toBe(1);
  });

  it("returns 404 for unknown or expired codes", async () => {
    repo.items.set("old", { code: "old", url: "https://a.com", clicks: 0, createdAt: "", expiresAt: 1 });
    const redirect = makeRedirectHandler(repo);
    expect(status(await redirect(event({ pathParameters: { code: "nope" } })))).toBe(404);
    expect(status(await redirect(event({ pathParameters: { code: "old" } })))).toBe(404);
  });
});
