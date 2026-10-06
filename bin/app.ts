import { App } from "aws-cdk-lib";
import { SnaplinkStack } from "../lib/snaplink-stack.js";

const app = new App();
new SnaplinkStack(app, "Snaplink", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  retainData: app.node.tryGetContext("retainData") !== "false",
});
