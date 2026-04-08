"""
EC2 Start/Stop Scheduler Lambda.

Triggered by EventBridge on a cron schedule.
Reads the action (start/stop) from the event and the instance ID from env vars.
"""

import os
import boto3

ec2 = boto3.client("ec2", region_name=os.environ.get("AWS_REGION", "us-east-1"))
INSTANCE_ID = os.environ["EC2_INSTANCE_ID"]


def handler(event, context):
    action = event.get("action", "")

    if action == "stop":
        print(f"Stopping instance {INSTANCE_ID}")
        ec2.stop_instances(InstanceIds=[INSTANCE_ID])
        return {"status": "stopped", "instance": INSTANCE_ID}

    elif action == "start":
        print(f"Starting instance {INSTANCE_ID}")
        ec2.start_instances(InstanceIds=[INSTANCE_ID])
        return {"status": "started", "instance": INSTANCE_ID}

    else:
        raise ValueError(f"Unknown action: {action}. Expected 'start' or 'stop'.")
