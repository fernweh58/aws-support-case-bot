import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class EventBridgeBusAndRules {
  public larkbotCaseEventBus: events.EventBus;

  constructor(scope: Construct, msgEventAlias: lambda.Alias, refreshInterval: number) {
    const stack = cdk.Stack.of(scope);

    // Create a new EventBus
    this.larkbotCaseEventBus = new events.EventBus(scope, 'larkbot-case-event-bus', {
    });

    // Create a new rule for the EventBus
    const larkbotCaseEventRule = new events.Rule(scope, 'larkbot-case-event-rule', {
      eventBus: this.larkbotCaseEventBus,
      eventPattern: {
        source: [
          'aws.support'
        ]
      },
      description: 'Rule to trigger Lambda on case event',
    });

    // Add target to the rule
    larkbotCaseEventRule.addTarget(new targets.LambdaFunction(msgEventAlias, {
      event: events.RuleTargetInput.fromObject({
        schema: "2.0",
        event: {
          message: {
            message_type: "fresh_comment"
          }
        }
      })
    }));

    // Create a resource-based policy for the EventBus
    new events.CfnEventBusPolicy(scope, 'EventBusPolicy', {
      eventBusName: this.larkbotCaseEventBus.eventBusName,
      statementId: 'AllowAccountsToPutEvents',
      statement: {
        Effect: "Allow",
        Principal: { AWS: `arn:aws:iam::${stack.account}:root` },
        Action: "events:PutEvents",
        Resource: this.larkbotCaseEventBus.eventBusArn
      }
    });

    // Forward aws.support events from local default bus to custom bus
    const forwardRole = new iam.Role(scope, 'EventBridgeForwardRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
    });
    this.larkbotCaseEventBus.grantPutEventsTo(forwardRole);

    new events.Rule(scope, 'forwardSupportEvents', {
      eventPattern: { source: ['aws.support'] },
      description: 'Forward AWS Support events to Lark bot event bus',
      targets: [new targets.EventBus(this.larkbotCaseEventBus)],
    });

    // Cross-region forwarding: aws.support events only fire in us-east-1.
    // If deployed to another region, create a rule in us-east-1 to forward events.
    const crossRegionRuleName = `forward-support-to-${stack.region}`;

    const crossRegionRole = new iam.Role(scope, 'CrossRegionForwardRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        PutEvents: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [this.larkbotCaseEventBus.eventBusArn],
          })],
        }),
      },
    });

    new cr.AwsCustomResource(scope, 'CrossRegionForwardRule', {
      onCreate: {
        service: 'EventBridge',
        action: 'putRule',
        parameters: {
          Name: crossRegionRuleName,
          EventPattern: JSON.stringify({ source: ['aws.support'] }),
          Description: `Forward AWS Support events to ${stack.region} Lark bot`,
          State: 'ENABLED',
        },
        region: 'us-east-1',
        physicalResourceId: cr.PhysicalResourceId.of(crossRegionRuleName),
      },
      onDelete: {
        service: 'EventBridge',
        action: 'removeTargets',
        parameters: {
          Rule: crossRegionRuleName,
          Ids: ['larkbot-cross-region'],
        },
        region: 'us-east-1',
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['events:PutRule', 'events:PutTargets', 'events:RemoveTargets', 'events:DeleteRule'],
          resources: [`arn:aws:events:us-east-1:${stack.account}:rule/${crossRegionRuleName}`],
        }),
      ]),
    });

    new cr.AwsCustomResource(scope, 'CrossRegionForwardTarget', {
      onCreate: {
        service: 'EventBridge',
        action: 'putTargets',
        parameters: {
          Rule: crossRegionRuleName,
          Targets: [{
            Id: 'larkbot-cross-region',
            Arn: this.larkbotCaseEventBus.eventBusArn,
            RoleArn: crossRegionRole.roleArn,
          }],
        },
        region: 'us-east-1',
        physicalResourceId: cr.PhysicalResourceId.of(`${crossRegionRuleName}-target`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['events:PutTargets'],
          resources: [`arn:aws:events:us-east-1:${stack.account}:rule/${crossRegionRuleName}`],
        }),
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [crossRegionRole.roleArn],
        }),
      ]),
    });

    // Refresh case rule (enabled by default)
    const refreshEventRule = new events.Rule(scope, 'refreshCaseRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(refreshInterval)),
      description: `Refresh case update every ${refreshInterval} minutes`,
      enabled: true,
    });

    refreshEventRule.addTarget(new targets.LambdaFunction(msgEventAlias, {
      event: events.RuleTargetInput.fromObject({
        schema: "2.0",
        event: {
          message: {
            message_type: "fresh_comment"
          }
        }
      })
    }));
  }
}
