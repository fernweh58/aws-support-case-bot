import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnParameters } from './constructs/parameters';
import { DynamoDBTables } from './constructs/dynamodb-tables';
import { DynamoDBInit } from './constructs/dynamodb-init';
import { VpcNetwork } from './constructs/vpc';
import { LambdaFunctions } from './constructs/lambda-functions';
import { ApiGateway } from './constructs/apigateway';
import { EventBridgeBusAndRules } from './constructs/eventbridge';

export class LarkAwsKnowledgeAssistantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const parameters = new CfnParameters(this);
    const dynamoDBTables = new DynamoDBTables(this);
    new DynamoDBInit(
      this,
      dynamoDBTables.botConfigTable,
      parameters.appIdSecretArn.valueAsString,
      parameters.appSecretSecretArn.valueAsString,
      parameters.supportRoleArn.valueAsString,
      parameters.configKey,
      this.account,
      parameters.accountName.valueAsString,
    );
    const vpcNetwork = new VpcNetwork(this);
    const lambdaFunctions = new LambdaFunctions(this, dynamoDBTables, parameters, vpcNetwork.vpc);
    new ApiGateway(this, lambdaFunctions.msgEventAlias);
    const eventBridgeBusAndRules = new EventBridgeBusAndRules(this, lambdaFunctions.msgEventAlias, parameters.refreshInterval);

    new cdk.CfnOutput(this, 'msgEventRoleArn', {
      value: lambdaFunctions.msgEventAlias.role!.roleArn,
      description: 'Lambda execution role ARN (add to FeishuSupportCaseApiAll trust policy)',
    });

    new cdk.CfnOutput(this, 'larkbotCaseEventBusArn', {
      value: eventBridgeBusAndRules.larkbotCaseEventBus.eventBusArn,
      description: 'EventBridge custom bus ARN',
    });
  }
}
