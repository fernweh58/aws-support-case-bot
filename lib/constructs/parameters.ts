import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CfnParameters {
  public readonly appIdSecretArn: cdk.CfnParameter;
  public readonly appSecretSecretArn: cdk.CfnParameter;
  public readonly supportRoleArn: cdk.CfnParameter;
  public readonly accountName: cdk.CfnParameter;
  public readonly userWhitelist: cdk.CfnParameter;

  // Fixed defaults (not exposed as CloudFormation parameters)
  public readonly caseLanguage = 'zh';
  public readonly configKey = 'LarkBotProfile-0';
  public readonly botEndpoint = 'lark';
  public readonly refreshInterval = 10;
  public readonly supportRegion = 'en';

  constructor(scope: Construct) {
    this.appIdSecretArn = new cdk.CfnParameter(scope, 'AppIdSecretArn', {
      type: 'String',
      description: 'ARN of the Secrets Manager secret containing Lark App ID (create manually before deploying)',
    });

    this.appSecretSecretArn = new cdk.CfnParameter(scope, 'AppSecretSecretArn', {
      type: 'String',
      description: 'ARN of the Secrets Manager secret containing Lark App Secret (create manually before deploying)',
    });

    this.supportRoleArn = new cdk.CfnParameter(scope, 'SupportRoleArn', {
      type: 'String',
      description: 'ARN of the IAM role with AWSSupportAccess (create manually before deploying)',
    });

    this.accountName = new cdk.CfnParameter(scope, 'AccountName', {
      type: 'String',
      description: 'Display name for the AWS account (shown in Lark card)',
      default: 'My AWS Account',
    });

    this.userWhitelist = new cdk.CfnParameter(scope, 'UserWhitelist', {
      type: 'String',
      description: 'Enable user white list function',
      allowedValues: ["true", "false"],
      default: 'true',
    });
  }
}
