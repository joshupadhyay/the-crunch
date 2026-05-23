import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class InfraCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imageTag = this.node.tryGetContext('imageTag') || process.env.IMAGE_TAG || 'latest';
    const appSecretName = this.node.tryGetContext('appSecretName') || process.env.APP_SECRET_NAME || 'the-crunch/app-env';

    const chatTable = new dynamodb.Table(this, 'ChatTable', {
      tableName: 'the-crunch-chat',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    chatTable.addGlobalSecondaryIndex({
      indexName: 'entityType-createdAt-index',
      partitionKey: { name: 'entityType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const repository = ecr.Repository.fromRepositoryName(this, 'Repository', 'the-crunch');
    const appSecret = secretsmanager.Secret.fromSecretNameV2(this, 'AppSecret', appSecretName);

    const appFn = new lambda.DockerImageFunction(this, 'WebApp', {
      functionName: 'the-crunch-web',
      code: lambda.DockerImageCode.fromEcr(repository, {
        tagOrDigest: imageTag,
      }),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(15),
      architecture: lambda.Architecture.X86_64,
      environment: {
        NODE_ENV: 'production',
        CHAT_STORE: 'dynamodb',
        CHAT_TABLE_NAME: chatTable.tableName,
        THE_CRUNCH_SECRET_ID: appSecret.secretName,
        AWS_LWA_PORT: '3000',
        AWS_LWA_INVOKE_MODE: 'response_stream',
      },
    });

    chatTable.grantReadWriteData(appFn);
    repository.grantPull(appFn);
    appSecret.grantRead(appFn);

    const functionUrl = appFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(functionUrl),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      comment: 'The Crunch serverless web app',
    });

    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: functionUrl.url,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, 'ChatTableName', {
      value: chatTable.tableName,
    });
  }
}
