import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class InfraCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The EC2 instance ID — passed as a CDK context variable or env var.
    // Deploy with: cdk deploy -c instanceId=i-0abc123def456
    const instanceId = this.node.tryGetContext('instanceId')
      || process.env.EC2_INSTANCE_ID;

    if (!instanceId) {
      throw new Error('EC2 instance ID required. Pass via: cdk deploy -c instanceId=i-0abc123...');
    }

    // =========================================================================
    // Lambda — starts/stops the EC2 instance
    // =========================================================================
    const schedulerFn = new lambda.Function(this, 'Ec2Scheduler', {
      functionName: 'the-crunch-ec2-scheduler',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'scheduler.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        EC2_INSTANCE_ID: instanceId,
      },
    });

    // Grant the Lambda permission to start/stop this specific EC2 instance
    schedulerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ec2:StartInstances', 'ec2:StopInstances'],
      resources: [`arn:aws:ec2:*:${this.account}:instance/${instanceId}`],
    }));

    // Also need DescribeInstances (doesn't support resource-level permissions)
    schedulerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ec2:DescribeInstances'],
      resources: ['*'],
    }));

    // =========================================================================
    // EventBridge Rules — cron schedules (all times in UTC)
    //
    // US Eastern:  9am ET = 1pm UTC (2pm during EST, 1pm during EDT)
    //              8pm ET = midnight UTC (1am during EST, midnight during EDT)
    //
    // Using EDT (summer) times. Adjust if needed for EST (winter).
    // =========================================================================

    // Stop at 8pm ET (midnight UTC) every day
    const stopRule = new events.Rule(this, 'StopRule', {
      ruleName: 'the-crunch-stop-ec2',
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      description: 'Stop the-crunch EC2 at 8pm ET (midnight UTC)',
    });
    stopRule.addTarget(new targets.LambdaFunction(schedulerFn, {
      event: events.RuleTargetInput.fromObject({ action: 'stop' }),
    }));

    // Start at 9am ET (1pm UTC) every day
    const startRule = new events.Rule(this, 'StartRule', {
      ruleName: 'the-crunch-start-ec2',
      schedule: events.Schedule.cron({ minute: '0', hour: '13' }),
      description: 'Start the-crunch EC2 at 9am ET (1pm UTC)',
    });
    startRule.addTarget(new targets.LambdaFunction(schedulerFn, {
      event: events.RuleTargetInput.fromObject({ action: 'start' }),
    }));

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'SchedulerFunctionName', {
      value: schedulerFn.functionName,
    });
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instanceId,
    });
    new cdk.CfnOutput(this, 'StopSchedule', {
      value: '8pm ET (midnight UTC) daily',
    });
    new cdk.CfnOutput(this, 'StartSchedule', {
      value: '9am ET (1pm UTC) daily',
    });
  }
}
