import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';

export class LambdaFunctions {
  public readonly msgEventAlias: lambda.Alias;

  constructor(
    scope: Construct,
    dynamoDBTables: { auditTable: dynamodb.Table; botCasesTable: dynamodb.Table; botConfigTable: dynamodb.Table },
    params: {
      appIdSecretArn: cdk.CfnParameter;
      appSecretSecretArn: cdk.CfnParameter;
      supportRoleArn: cdk.CfnParameter;
      userWhitelist: cdk.CfnParameter;
      configKey: string;
      caseLanguage: string;
      supportRegion: string;
      botEndpoint: string;
    },
    vpc?: ec2.Vpc
  ) {
    // Import pre-created secrets by ARN
    const appIdSecret = secretsmanager.Secret.fromSecretCompleteArn(scope, 'AppIDSecret', params.appIdSecretArn.valueAsString);
    const appSecretSecret = secretsmanager.Secret.fromSecretCompleteArn(scope, 'AppSecretSecret', params.appSecretSecretArn.valueAsString);

    const msgEventFunction = new lambda.Function(scope, 'larkbot-msg-event', {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/msg-event'), {
        exclude: ['*', '!bootstrap'],
      }),
      timeout: cdk.Duration.minutes(1),
      ...(vpc ? {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      } : {}),
      environment: {
        AUDIT_TABLE: dynamoDBTables.auditTable.tableName,
        CASES_TABLE: dynamoDBTables.botCasesTable.tableName,
        CFG_TABLE: dynamoDBTables.botConfigTable.tableName,
        CFG_KEY: params.configKey,
        CASE_LANGUAGE: params.caseLanguage,
        ENABLE_USER_WHITELIST: params.userWhitelist.valueAsString,
        SUPPORT_REGION: params.supportRegion,
        BOT_ENDPOINT: params.botEndpoint
      }
    });

    const msgEventVersion = msgEventFunction.currentVersion;

    this.msgEventAlias = new lambda.Alias(scope, 'msg-event-prod', {
      aliasName: 'Prod',
      version: msgEventVersion,
      provisionedConcurrentExecutions: 1,
    });

    // Grant read access to pre-created secrets
    appIdSecret.grantRead(this.msgEventAlias);
    appSecretSecret.grantRead(this.msgEventAlias);

    // Allow AssumeRole to the pre-created Support role
    this.msgEventAlias.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowToAssumeToRoleWithSupportAPIAccess',
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [params.supportRoleArn.valueAsString]
    }));

    // Grant RW access of ddb tables
    dynamoDBTables.auditTable.grantReadWriteData(this.msgEventAlias);
    dynamoDBTables.botCasesTable.grantReadWriteData(this.msgEventAlias);
    dynamoDBTables.botConfigTable.grantReadWriteData(this.msgEventAlias);
  }
}
