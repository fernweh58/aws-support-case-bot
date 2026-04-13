import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class DynamoDBInit {
  constructor(
    scope: Construct,
    configTable: dynamodb.Table,
    secrets: { AppIDSecret: secretsmanager.Secret; AppSecretSecret: secretsmanager.Secret },
    configKey: string,
    accountId: string,
  ) {
    new cr.AwsCustomResource(scope, 'InitBotConfig', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: configTable.tableName,
          Item: {
            key: { S: configKey },
            app_id_arn: { S: secrets.AppIDSecret.secretArn },
            app_secret_arn: { S: secrets.AppSecretSecret.secretArn },
            ack: { S: 'Your message has been received' },
            no_permission_msg: { S: '你没有权限使用工单机器人，请联系管理员。' },
            accounts: { M: {
              '0': { M: { role_arn: { S: `arn:aws:iam::${accountId}:role/FeishuSupportCaseApiAll` } } }
            }},
            service_map: { M: {
              '0': { L: [{ S: 'general-info' }, { S: 'using-aws' }] },
              '1': { L: [{ S: 'amazon-elastic-compute-cloud-linux' }, { S: 'other' }] },
              '2': { L: [{ S: 'amazon-simple-storage-service' }, { S: 'general-guidance' }] },
              '3': { L: [{ S: 'amazon-virtual-private-cloud' }, { S: 'general-guidance' }] },
              '4': { L: [{ S: 'elastic-load-balancing' }, { S: 'general-guidance' }] },
              '5': { L: [{ S: 'amazon-relational-database-service-aurora' }, { S: 'general-guidance' }] },
              '6': { L: [{ S: 'amazon-cloudfront' }, { S: 'general-guidance' }] },
              '7': { L: [{ S: 'aws-lambda' }, { S: 'general-guidance' }] },
              '8': { L: [{ S: 'amazon-cloudwatch' }, { S: 'general-guidance' }] },
              '9': { L: [{ S: 'aws-identity-and-access-management' }, { S: 'general-guidance' }] },
              '10': { L: [{ S: 'amazon-dynamodb' }, { S: 'general-guidance' }] },
              '11': { L: [{ S: 'service-eks' }, { S: 'general-guidance' }] },
              '12': { L: [{ S: 'ec2-container-service' }, { S: 'general-guidance' }] },
              '13': { L: [{ S: 'amazon-route53' }, { S: 'general-guidance' }] },
              '14': { L: [{ S: 'aws-direct-connect' }, { S: 'general-guidance' }] },
              '15': { L: [{ S: 'sagemaker' }, { S: 'general-guidance' }] },
              '16': { L: [{ S: 'service-bedrock' }, { S: 'general-guidance' }] },
              '17': { L: [{ S: 'api-gateway' }, { S: 'general-guidance' }] },
              '18': { L: [{ S: 'amazon-simple-notification-service' }, { S: 'general-guidance' }] },
              '19': { L: [{ S: 'amazon-simple-queue-service' }, { S: 'general-guidance' }] },
              '20': { L: [{ S: 'aws-glue' }, { S: 'general-guidance' }] },
              '21': { L: [{ S: 'amazon-athena' }, { S: 'general-guidance' }] },
              '22': { L: [{ S: 'amazon-redshift' }, { S: 'general-guidance' }] },
              '23': { L: [{ S: 'amazon-elasticache' }, { S: 'general-guidance' }] },
              '24': { L: [{ S: 'aws-step-functions' }, { S: 'general-guidance' }] },
              '25': { L: [{ S: 'aws-cloudformation' }, { S: 'general-guidance' }] },
              '26': { L: [{ S: 'amazon-kinesis' }, { S: 'general-guidance' }] },
              '27': { L: [{ S: 'secrets-manager' }, { S: 'general-guidance' }] },
              '28': { L: [{ S: 'billing' }, { S: 'general-guidance' }] },
              '29': { L: [{ S: 'customer-account' }, { S: 'general-guidance' }] },
            }},
            sev_map: { M: {
              low: { S: 'low' }, normal: { S: 'normal' }, high: { S: 'high' },
              urgent: { S: 'urgent' }, critical: { S: 'critical' },
            }},
            user_whitelist: { M: {} },
            role: { M: {} },
            case_card_template: { M: {
              msg_type: { S: 'interactive' },
              update_multi: { BOOL: true },
              card: { M: {
                config: { M: { wide_screen_mode: { BOOL: true } } },
                elements: { L: [
                  { M: { Tag: { S: 'markdown' }, Content: { S: '**当前工单信息**\n --------------\n\n ' }, Extra: { M: { Tag: { S: '' }, InitialOption: { S: '' }, Options: { NULL: true }, Placeholder: { M: { Content: { S: '' }, Tag: { S: '' } } }, Value: { M: { Key: { S: 'info' } } } } }, Href: { M: { URLVal: { M: { URL: { S: '' }, AndroidURL: { S: '' }, IosURL: { S: '' }, PcURL: { S: '' } } } } }, Text: { M: { Content: { S: '' }, Tag: { S: '' } } } } },
                  { M: { Tag: { S: 'markdown' }, Content: { S: '**题目：**' }, Extra: { M: { Tag: { S: '' }, InitialOption: { S: '' }, Options: { NULL: true }, Placeholder: { M: { Content: { S: '' }, Tag: { S: '' } } }, Value: { M: { Key: { S: 'title' } } } } }, Href: { M: { URLVal: { M: { URL: { S: '' }, AndroidURL: { S: '' }, IosURL: { S: '' }, PcURL: { S: '' } } } } }, Text: { M: { Content: { S: '' }, Tag: { S: '' } } } } },
                  { M: { tag: { S: 'div' }, text: { M: { content: { S: '**账户**' }, tag: { S: 'lark_md' } } }, extra: { M: { tag: { S: 'select_static' }, placeholder: { M: { content: { S: '账户' }, tag: { S: 'plain_text' } } }, value: { M: { key: { S: '账户' } } }, options: { L: [{ M: { text: { M: { content: { S: `Account-${accountId}` }, tag: { S: 'plain_text' } } }, value: { S: '0' } } }] } } } } },
                  { M: { tag: { S: 'div' }, text: { M: { content: { S: '**服务**' }, tag: { S: 'lark_md' } } }, extra: { M: { tag: { S: 'select_static' }, placeholder: { M: { content: { S: '请选择服务内容' }, tag: { S: 'plain_text' } } }, value: { M: { key: { S: '服务' } } }, options: { L: [
                    { M: { text: { M: { content: { S: 'General Info' }, tag: { S: 'plain_text' } } }, value: { S: '0' } } },
                    { M: { text: { M: { content: { S: 'EC2 Linux' }, tag: { S: 'plain_text' } } }, value: { S: '1' } } },
                    { M: { text: { M: { content: { S: 'S3' }, tag: { S: 'plain_text' } } }, value: { S: '2' } } },
                    { M: { text: { M: { content: { S: 'VPC' }, tag: { S: 'plain_text' } } }, value: { S: '3' } } },
                    { M: { text: { M: { content: { S: 'ELB' }, tag: { S: 'plain_text' } } }, value: { S: '4' } } },
                    { M: { text: { M: { content: { S: 'Aurora' }, tag: { S: 'plain_text' } } }, value: { S: '5' } } },
                    { M: { text: { M: { content: { S: 'CloudFront' }, tag: { S: 'plain_text' } } }, value: { S: '6' } } },
                    { M: { text: { M: { content: { S: 'Lambda' }, tag: { S: 'plain_text' } } }, value: { S: '7' } } },
                    { M: { text: { M: { content: { S: 'CloudWatch' }, tag: { S: 'plain_text' } } }, value: { S: '8' } } },
                    { M: { text: { M: { content: { S: 'IAM' }, tag: { S: 'plain_text' } } }, value: { S: '9' } } },
                    { M: { text: { M: { content: { S: 'DynamoDB' }, tag: { S: 'plain_text' } } }, value: { S: '10' } } },
                    { M: { text: { M: { content: { S: 'EKS' }, tag: { S: 'plain_text' } } }, value: { S: '11' } } },
                    { M: { text: { M: { content: { S: 'ECS' }, tag: { S: 'plain_text' } } }, value: { S: '12' } } },
                    { M: { text: { M: { content: { S: 'Route 53' }, tag: { S: 'plain_text' } } }, value: { S: '13' } } },
                    { M: { text: { M: { content: { S: 'Direct Connect' }, tag: { S: 'plain_text' } } }, value: { S: '14' } } },
                    { M: { text: { M: { content: { S: 'SageMaker' }, tag: { S: 'plain_text' } } }, value: { S: '15' } } },
                    { M: { text: { M: { content: { S: 'Bedrock' }, tag: { S: 'plain_text' } } }, value: { S: '16' } } },
                    { M: { text: { M: { content: { S: 'API Gateway' }, tag: { S: 'plain_text' } } }, value: { S: '17' } } },
                    { M: { text: { M: { content: { S: 'SNS' }, tag: { S: 'plain_text' } } }, value: { S: '18' } } },
                    { M: { text: { M: { content: { S: 'SQS' }, tag: { S: 'plain_text' } } }, value: { S: '19' } } },
                    { M: { text: { M: { content: { S: 'Glue' }, tag: { S: 'plain_text' } } }, value: { S: '20' } } },
                    { M: { text: { M: { content: { S: 'Athena' }, tag: { S: 'plain_text' } } }, value: { S: '21' } } },
                    { M: { text: { M: { content: { S: 'Redshift' }, tag: { S: 'plain_text' } } }, value: { S: '22' } } },
                    { M: { text: { M: { content: { S: 'ElastiCache' }, tag: { S: 'plain_text' } } }, value: { S: '23' } } },
                    { M: { text: { M: { content: { S: 'Step Functions' }, tag: { S: 'plain_text' } } }, value: { S: '24' } } },
                    { M: { text: { M: { content: { S: 'CloudFormation' }, tag: { S: 'plain_text' } } }, value: { S: '25' } } },
                    { M: { text: { M: { content: { S: 'Kinesis' }, tag: { S: 'plain_text' } } }, value: { S: '26' } } },
                    { M: { text: { M: { content: { S: 'Secrets Manager' }, tag: { S: 'plain_text' } } }, value: { S: '27' } } },
                    { M: { text: { M: { content: { S: '账单' }, tag: { S: 'plain_text' } } }, value: { S: '28' } } },
                    { M: { text: { M: { content: { S: '账户' }, tag: { S: 'plain_text' } } }, value: { S: '29' } } },
                  ] } } } } },
                  { M: { tag: { S: 'div' }, text: { M: { content: { S: '**响应速度**' }, tag: { S: 'lark_md' } } }, extra: { M: { tag: { S: 'select_static' }, placeholder: { M: { content: { S: '响应速度' }, tag: { S: 'plain_text' } } }, value: { M: { key: { S: '响应速度' } } }, options: { L: [
                    { M: { text: { M: { content: { S: '一般性指导 (24h)' }, tag: { S: 'plain_text' } } }, value: { S: 'low' } } },
                    { M: { text: { M: { content: { S: '系统受损 (12h)' }, tag: { S: 'plain_text' } } }, value: { S: 'normal' } } },
                    { M: { text: { M: { content: { S: '生产系统受损 (4h)' }, tag: { S: 'plain_text' } } }, value: { S: 'high' } } },
                    { M: { text: { M: { content: { S: '生产系统停机 (1h)' }, tag: { S: 'plain_text' } } }, value: { S: 'urgent' } } },
                    { M: { text: { M: { content: { S: '业务关键系统停机 (15min)' }, tag: { S: 'plain_text' } } }, value: { S: 'critical' } } },
                  ] } } } } },
                  { M: { Tag: { S: 'markdown' }, Content: { S: '**内容：** ' }, Extra: { M: { Tag: { S: '' }, InitialOption: { S: '' }, Options: { NULL: true }, Placeholder: { M: { Content: { S: '' }, Tag: { S: '' } } }, Value: { M: { Key: { S: 'content' } } } } }, Href: { M: { URLVal: { M: { URL: { S: '' }, AndroidURL: { S: '' }, IosURL: { S: '' }, PcURL: { S: '' } } } } }, Text: { M: { Content: { S: '' }, Tag: { S: '' } } } } },
                  { M: { tag: { S: 'markdown' }, content: { S: '\n --------------\n**工单助手**\n\n创建AWS支持工单步骤：\n1. 输入「SUBJECT + 工单标题」开始创建工单\n2. 在卡片中选择账户、服务类型和严重级别\n3. 输入「DESCRIPTION + 问题描述」提交工单内容\n\n工单群操作：\n- @机器人 发送消息即可更新工单\n- @机器人 RESOLVE 或 @机器人 关闭工单 可关闭工单\n\n其他命令：\n- 「历史」查询工单记录\n- 「帮助」或「HELP」查看使用说明' } } },
                ] }
              }}
            }},
          },
          ConditionExpression: 'attribute_not_exists(#k)',
          ExpressionAttributeNames: { '#k': 'key' },
        },
        physicalResourceId: cr.PhysicalResourceId.of('InitBotConfig'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [configTable.tableArn],
      }),
    });
  }
}
