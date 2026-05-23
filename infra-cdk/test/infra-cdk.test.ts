import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as InfraCdk from '../lib/infra-cdk-stack';

test('deploys serverless web app resources', () => {
  const app = new cdk.App({
    context: {
      imageTag: 'test-image-tag',
      appSecretName: 'the-crunch/test-env',
    },
  });
  const stack = new InfraCdk.InfraCdkStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    BillingMode: 'PAY_PER_REQUEST',
    PointInTimeRecoverySpecification: {
      PointInTimeRecoveryEnabled: true,
    },
  });

  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'the-crunch-web',
    PackageType: 'Image',
    Timeout: 900,
    Environment: {
      Variables: Match.objectLike({
        CHAT_STORE: 'dynamodb',
        THE_CRUNCH_SECRET_ID: 'the-crunch/test-env',
        AWS_LWA_INVOKE_MODE: 'response_stream',
      }),
    },
  });

  template.hasResourceProperties('AWS::Lambda::Url', {
    AuthType: 'NONE',
    InvokeMode: 'RESPONSE_STREAM',
  });
});
