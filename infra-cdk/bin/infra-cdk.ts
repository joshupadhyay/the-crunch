#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraCdkStack } from '../lib/infra-cdk-stack';

const app = new cdk.App();
new InfraCdkStack(app, 'TheCrunchInfra', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'The Crunch — serverless Lambda Web Adapter deployment',
});
