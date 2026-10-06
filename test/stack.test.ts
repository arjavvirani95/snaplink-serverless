import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { SnaplinkStack } from "../lib/snaplink-stack.js";

let template: Template;

beforeAll(() => {
  const app = new App();
  template = Template.fromStack(new SnaplinkStack(app, "Test", { retainData: false }));
}, 60_000);

describe("SnaplinkStack", () => {
  it("creates an on-demand table with TTL", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [{ AttributeName: "code", KeyType: "HASH" }],
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    });
  });

  it("creates three ARM Lambda functions with the table name", () => {
    const fns = template.findResources("AWS::Lambda::Function", {
      Properties: { Architectures: ["arm64"], Environment: { Variables: { TABLE_NAME: Match.anyValue() } } },
    });
    expect(Object.keys(fns)).toHaveLength(3);
  });

  it("exposes the expected routes", () => {
    const routes = Object.values(template.findResources("AWS::ApiGatewayV2::Route")).map(
      (r) => (r as { Properties: { RouteKey: string } }).Properties.RouteKey,
    );
    expect(routes.sort()).toEqual(["GET /links/{code}/stats", "GET /{code}", "POST /links"]);
  });

  it("throttles the default stage", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      DefaultRouteSettings: { ThrottlingBurstLimit: 50, ThrottlingRateLimit: 100 },
    });
  });

  it("gives the stats function read-only access", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    const stats = Object.entries(policies).find(([id]) => id.startsWith("StatsFn"))!;
    const actions = JSON.stringify(stats[1]);
    expect(actions).not.toContain("dynamodb:PutItem");
    expect(actions).toContain("dynamodb:GetItem");
  });
});
