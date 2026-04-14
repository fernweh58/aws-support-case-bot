import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';

export class LambdaFunctions {
  public readonly msgEventAlias: lambda.Alias;

  constructor(
    scope: Construct,
    dynamoDBTables: { auditTable: dynamodb.Table; botCasesTable: dynamodb.Table; botConfigTable: dynamodb.Table },
    secrets: { AppIDSecret: secretsmanager.Secret; AppSecretSecret: secretsmanager.Secret },
    params: { configKey: cdk.CfnParameter; caseLanguage: cdk.CfnParameter; userWhitelist: cdk.CfnParameter; supportRegion: cdk.CfnParameter; botEndpoint: cdk.CfnParameter }
  ) {
    // Define msgEvent handler
    const msgEventFunction = new lambda.Function(scope, 'larkbot-msg-event', {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/msg-event'), {
        exclude: ['*', '!bootstrap'],
      }),
      timeout: cdk.Duration.minutes(1),
      environment: {
        AUDIT_TABLE: dynamoDBTables.auditTable.tableName,
        CASES_TABLE: dynamoDBTables.botCasesTable.tableName,
        CFG_TABLE: dynamoDBTables.botConfigTable.tableName,
        CFG_KEY: params.configKey.valueAsString,
        CASE_LANGUAGE: params.caseLanguage.valueAsString,
        ENABLE_USER_WHITELIST: params.userWhitelist.valueAsString,
        SUPPORT_REGION: params.supportRegion.valueAsString,
        BOT_ENDPOINT: params.botEndpoint.valueAsString
      }
    });

    const msgEventVersion = msgEventFunction.currentVersion;

    this.msgEventAlias = new lambda.Alias(scope, 'msg-event-prod', {
      aliasName: 'Prod',
      version: msgEventVersion,
    });

    // Grant the RO access of AppID and AppSecret to msgEvent function
    secrets.AppIDSecret.grantRead(this.msgEventAlias);
    secrets.AppSecretSecret.grantRead(this.msgEventAlias);

    // Attach the policy document that allow to assume the support role in others accounts to the lambda function's role
    this.msgEventAlias.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowToAssumeToRoleWithSupportAPIAccess',
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${cdk.Stack.of(scope).account}:role/FeishuSupportCaseApiAll`]
    }));

    // Grant RW access of ddb tables to msgEvent function 
    dynamoDBTables.auditTable.grantReadWriteData(this.msgEventAlias);
    dynamoDBTables.botCasesTable.grantReadWriteData(this.msgEventAlias);
    dynamoDBTables.botConfigTable.grantReadWriteData(this.msgEventAlias);
  }
}
