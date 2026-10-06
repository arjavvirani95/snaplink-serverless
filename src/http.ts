import type { APIGatewayProxyResultV2 } from "aws-lambda";

export const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function parseBody(raw: string | undefined, isBase64 = false): Record<string, unknown> | null {
  if (!raw) return {};
  try {
    const text = isBase64 ? Buffer.from(raw, "base64").toString("utf8") : raw;
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
