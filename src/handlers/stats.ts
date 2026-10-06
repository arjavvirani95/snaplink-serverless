import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { json } from "../http.js";
import { DynamoLinkRepo, type LinkRepo } from "../repo.js";

export function makeStatsHandler(repo: LinkRepo) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const code = event.pathParameters?.code;
    const link = code ? await repo.get(code) : undefined;
    if (!link) return json(404, { error: "Link not found" });
    return json(200, link);
  };
}

export const handler = makeStatsHandler(new DynamoLinkRepo(process.env.TABLE_NAME!));
