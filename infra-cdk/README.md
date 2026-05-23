# The Crunch Serverless Infrastructure

This CDK app deploys The Crunch without an always-on EC2 host.

## Architecture

- Existing ECR image: `the-crunch:<imageTag>`
- Lambda container runtime with Lambda Web Adapter
- Lambda Function URL in `RESPONSE_STREAM` mode
- CloudFront in front of the Function URL with origin access control
- DynamoDB on-demand table for chat conversations and messages
- AWS Secrets Manager secret for runtime app configuration

The default secret name is `the-crunch/app-env`. It should contain JSON values
for the app environment, for example:

```json
{
  "ANTHROPIC_API_KEY": "...",
  "DATABASE_URL": "...",
  "MAPBOX_ACCESS_TOKEN": "...",
  "BETTER_AUTH_URL": "...",
  "LANGFUSE_PUBLIC_KEY": "...",
  "LANGFUSE_SECRET_KEY": "...",
  "LANGFUSE_BASE_URL": "https://cloud.langfuse.com"
}
```

Deploy with a specific image tag:

```sh
npx cdk deploy --require-approval never -c imageTag=<git-sha>
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
