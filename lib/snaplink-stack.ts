import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { CfnStage, CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface SnaplinkStackProps extends StackProps {
  /** Keep the table when the stack is deleted. Defaults to true. */
  retainData?: boolean;
}

export class SnaplinkStack extends Stack {
  constructor(scope: Construct, id: string, props: SnaplinkStackProps = {}) {
    super(scope, id, props);

    const table = new Table(this, "Links", {
      partitionKey: { name: "code", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: props.retainData === false ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    const fn = (name: string) =>
      new NodejsFunction(this, `${name}Fn`, {
        entry: path.join(here, `../src/handlers/${name.toLowerCase()}.ts`),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(5),
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: { TABLE_NAME: table.tableName },
        bundling: { minify: true, sourceMap: true },
      });

    const create = fn("Create");
    const redirect = fn("Redirect");
    const stats = fn("Stats");
    table.grantReadWriteData(create);
    table.grantReadWriteData(redirect);
    table.grantReadData(stats);

    const api = new HttpApi(this, "Api", {
      description: "Snaplink URL shortener",
      corsPreflight: { allowOrigins: ["*"], allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST], allowHeaders: ["content-type"] },
    });
    api.addRoutes({ path: "/links", methods: [HttpMethod.POST], integration: new HttpLambdaIntegration("CreateInt", create) });
    api.addRoutes({ path: "/links/{code}/stats", methods: [HttpMethod.GET], integration: new HttpLambdaIntegration("StatsInt", stats) });
    api.addRoutes({ path: "/{code}", methods: [HttpMethod.GET], integration: new HttpLambdaIntegration("RedirectInt", redirect) });

    // Basic abuse protection on the default stage.
    const stage = api.defaultStage!.node.defaultChild as CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 50, throttlingRateLimit: 100 };

    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
