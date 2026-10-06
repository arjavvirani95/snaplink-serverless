import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { expiryFromDays, generateCode, validateAlias, validateUrl, type Link } from "../links.js";
import { json, parseBody } from "../http.js";
import { DynamoLinkRepo, type LinkRepo } from "../repo.js";

const MAX_ATTEMPTS = 5;

export function makeCreateHandler(repo: LinkRepo, baseUrl: () => string) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const body = parseBody(event.body, event.isBase64Encoded);
    if (!body) return json(400, { error: "Body must be a JSON object" });

    const url = validateUrl(body.url);
    if ("error" in url) return json(400, url);

    const expiresAt = expiryFromDays(body.expiresInDays);
    if (typeof expiresAt === "object") return json(400, expiresAt);

    const link = (code: string): Link => ({
      code, url: url.url, clicks: 0, createdAt: new Date().toISOString(),
      ...(expiresAt ? { expiresAt } : {}),
    });

    if (body.alias !== undefined) {
      const alias = String(body.alias);
      const err = validateAlias(alias);
      if (err) return json(400, { error: err });
      if (!(await repo.create(link(alias)))) return json(409, { error: "Alias already in use" });
      return json(201, { code: alias, shortUrl: `${baseUrl()}/${alias}` });
    }

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const code = generateCode();
      if (await repo.create(link(code))) return json(201, { code, shortUrl: `${baseUrl()}/${code}` });
    }
    return json(503, { error: "Could not allocate a code, try again" });
  };
}

export const handler = makeCreateHandler(
  new DynamoLinkRepo(process.env.TABLE_NAME!),
  () => process.env.BASE_URL ?? "",
);
