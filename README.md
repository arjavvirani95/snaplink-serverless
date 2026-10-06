# snaplink-serverless

[![CI](https://github.com/arjavvirani95/snaplink-serverless/actions/workflows/ci.yml/badge.svg)](https://github.com/arjavvirani95/snaplink-serverless/actions/workflows/ci.yml)

A serverless URL shortener on **AWS Lambda**, **API Gateway (HTTP API)** and **DynamoDB**, defined as infrastructure-as-code with the **AWS CDK** in TypeScript.

```
client ──► API Gateway (HTTP API, throttled)
              ├─ POST /links              ─► CreateFn   ─┐
              ├─ GET  /{code}  (302)      ─► RedirectFn ─┼─► DynamoDB "Links" (on-demand, TTL)
              └─ GET  /links/{code}/stats ─► StatsFn    ─┘   (read-only IAM)
```

## Features

- Random 7-character base62 codes, with collision handling through DynamoDB conditional writes
- Custom aliases (`"alias": "launch"`) with validation and reserved words
- Optional expiry (`"expiresInDays": 30`) using DynamoDB TTL, and expired links return 404 straight away
- Click counting with atomic `ADD` updates; a failed count never blocks the redirect
- Only `http`/`https` targets are accepted, which blocks `javascript:` and similar schemes
- Least-privilege IAM per function, ARM64 Lambdas, minified esbuild bundles of about 3 KB, 2-week log retention
- Throttling on the API stage

## API

```bash
curl -X POST $API/links -H 'content-type: application/json' \
  -d '{"url":"https://example.com/very/long/path","alias":"demo","expiresInDays":30}'
# {"code":"demo","shortUrl":"https://<api>/demo"}

curl -i $API/demo              # 302 Location: https://example.com/very/long/path
curl $API/links/demo/stats     # {"code":"demo","clicks":1,...}
```

## Tests

- **Handler tests** run the Lambda handlers against an in-memory repository (no AWS needed)
- **Infrastructure tests** use `aws-cdk-lib/assertions` to check the synthesized CloudFormation: table config, routes, throttling, and IAM least privilege

```bash
npm install
npm test
```

## Deploy

Requires AWS credentials and a bootstrapped account (`npx cdk bootstrap`).

```bash
npx cdk deploy                         # data is retained on stack deletion
npx cdk deploy -c retainData=false     # throwaway environments
```

Set `BASE_URL` on the create function if you put a custom domain in front of the API.

## License

MIT
