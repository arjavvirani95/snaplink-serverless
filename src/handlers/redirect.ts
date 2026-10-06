import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { json } from "../http.js";
import { DynamoLinkRepo, type LinkRepo } from "../repo.js";

export function makeRedirectHandler(repo: LinkRepo) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const code = event.pathParameters?.code;
    const link = code ? await repo.get(code) : undefined;
    if (!link) return json(404, { error: "Link not found" });

    // Counting a click must never block or break the redirect.
    await repo.recordClick(link.code).catch((err) => console.error("recordClick failed", err));

    return { statusCode: 302, headers: { location: link.url, "cache-control": "no-store" } };
  };
}

export const handler = makeRedirectHandler(new DynamoLinkRepo(process.env.TABLE_NAME!));
