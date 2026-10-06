import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { expiryFromDays, generateCode, validateAlias, validateUrl, type Link } from "../links.js";
import { json, parseBody } from "../http.js";
import { DynamoLinkRepo, type LinkRepo } from "../repo.js";

const MAX_ATTEMPTS = 5;

type BaseUrl = (event: APIGatewayProxyEventV2) => string;

/** Uses BASE_URL when set (custom domain), otherwise the API Gateway domain that received the request. */
const defaultBaseUrl: BaseUrl = (event) =>
  process.env.BASE_URL || `https://${event.requestContext?.domainName ?? "localhost"}`;

export function makeCreateHandler(repo: LinkRepo, baseUrl: BaseUrl = defaultBaseUrl) {
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
      return json(201, { code: alias, shortUrl: `${baseUrl(event)}/${alias}` });
    }

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const code = generateCode();
      if (await repo.create(link(code))) return json(201, { code, shortUrl: `${baseUrl(event)}/${code}` });
    }
    return json(503, { error: "Could not allocate a code, try again" });
  };
}

export const handler = makeCreateHandler(new DynamoLinkRepo(process.env.TABLE_NAME!));
