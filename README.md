# Lark AWS 工单机器人

## 概述

通过 Lark 聊天机器人创建、查看、更新 AWS Support Case。用户在 Lark 中通过关键字和卡片交互完成工单全流程。

## 当前部署信息

| 项目 | 值 |
|------|-----|
| AWS 账号 | 626635424126 |
| Region | us-east-1 |
| CloudFormation Stack | lark-support-bot |
| API Gateway | https://6nft40bgu9.execute-api.us-east-1.amazonaws.com/prod/ |
| Lark Webhook URL | https://6nft40bgu9.execute-api.us-east-1.amazonaws.com/prod/messages |
| Lark App ID | cli_a9522f9ac938de18 |
| Lark Endpoint | lark (larksuite.com) |
| 工单语言 | zh |
| Support Region | us-east-1 (en) |
| 白名单 | 已开启，管理员：868ad35b (tianyue) |

## 架构

```
Lark 用户
  │
  ▼
API Gateway (POST /messages) ── proxy 集成
  │
  ▼
Lambda: msg-event (Go, ARM64)
  ├── 解析 Lark 消息（文字/卡片/图片/附件）
  ├── 管理工单生命周期（DynamoDB）
  ├── STS AssumeRole → 调用 AWS Support API
  └── 调用 Lark API（发消息/建群/更新卡片）
  │
  ├── DynamoDB × 3
  │   ├── bot_config — 机器人配置（CDK 部署时自动初始化）
  │   ├── bot_cases  — 工单状态
  │   └── audit      — 审计/去重
  │
  ├── Secrets Manager × 2 — Lark App ID / App Secret
  │
  └── EventBridge
      ├── 自定义 Event Bus — 接收 aws.support 事件 → 实时推送
      ├── 转发规则 — default bus 的 aws.support → 自定义 bus（CDK 自动创建）
      └── 定时轮询规则 — 每 10 分钟检查工单更新（CDK 部署时默认启用）
```

## CDK 资源清单

| 资源 | 类型 | 说明 |
|------|------|------|
| larkbot-msg-event | Lambda (Go ARM64) | 核心消息处理 |
| msg-event-prod | Lambda Alias | Prod 别名 |
| msgEventapi | API Gateway (Edge) | Lark webhook 入口 |
| audit | DynamoDB | 消息去重 |
| bot_cases | DynamoDB | 工单状态管理 |
| bot_config | DynamoDB | 机器人配置（自动初始化） |
| InitBotConfig | Custom Resource | 首次部署时写入 DynamoDB 默认配置 |
| AppIDSecret | Secrets Manager | Lark App ID |
| AppSecretSecret | Secrets Manager | Lark App Secret |
| larkbot-case-event-bus | EventBridge Bus | 自定义事件总线 |
| larkbot-case-event-rule | EventBridge Rule | aws.support 事件触发 Lambda |
| forwardSupportEvents | EventBridge Rule | default bus → 自定义 bus 转发（自动创建） |
| refreshCaseRule | EventBridge Rule | 定时轮询（默认启用） |
| EventBridgeForwardRole | IAM Role | EventBridge 转发用（自动创建） |
| FeishuSupportCaseApiAll | IAM Role | Lambda AssumeRole 调用 Support API（需手动创建） |

## 支持的 AWS 服务列表

卡片中可选的服务（可通过 DynamoDB `bot_config` 表的 `service_map` 和 `case_card_template` 自定义）：

| # | 服务 | Service Code |
|---|------|-------------|
| 0 | General Info | general-info |
| 1 | EC2 Linux | amazon-elastic-compute-cloud-linux |
| 2 | S3 | amazon-simple-storage-service |
| 3 | VPC | amazon-virtual-private-cloud |
| 4 | ELB | elastic-load-balancing |
| 5 | Aurora | amazon-relational-database-service-aurora |
| 6 | CloudFront | amazon-cloudfront |
| 7 | Lambda | aws-lambda |
| 8 | CloudWatch | amazon-cloudwatch |
| 9 | IAM | aws-identity-and-access-management |
| 10 | DynamoDB | amazon-dynamodb |
| 11 | EKS | service-eks |
| 12 | ECS | ec2-container-service |
| 13 | Route 53 | amazon-route53 |
| 14 | Direct Connect | aws-direct-connect |
| 15 | SageMaker | sagemaker |
| 16 | Bedrock | service-bedrock |
| 17 | API Gateway | api-gateway |
| 18 | SNS | amazon-simple-notification-service |
| 19 | SQS | amazon-simple-queue-service |
| 20 | Glue | aws-glue |
| 21 | Athena | amazon-athena |
| 22 | Redshift | amazon-redshift |
| 23 | ElastiCache | amazon-elasticache |
| 24 | Step Functions | aws-step-functions |
| 25 | CloudFormation | aws-cloudformation |
| 26 | Kinesis | amazon-kinesis |
| 27 | Secrets Manager | secrets-manager |
| 28 | 账单 | billing |
| 29 | 账户 | customer-account |

> 增减服务只需修改 DynamoDB `bot_config` 表中的 `service_map` 和 `case_card_template` 里的 options，不需要改代码或重新部署。

## 部署步骤

### 前置条件

- AWS CLI 已配置
- Node.js、CDK、Go 已安装
- Lark 开放平台已创建自定义应用

### 1. 安装依赖

```bash
cd <项目根目录>
rm -rf node_modules package-lock.json
npm install
```

### 2. CDK Bootstrap（新账号/新 Region 首次需要）

```bash
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

### 3. 本地编译 Go Lambda（无需 Docker）

```bash
cd lambda/msg-event
GOPROXY=https://goproxy.cn,direct GOARCH=arm64 GOOS=linux go build -tags lambda.norpc -o bootstrap .
cd ../..
```

> 注意：CDK 已改为使用预编译 binary，不需要 Docker bundling。binary 跨账号通用，只需编译一次。

### 4. CDK 部署

如需部署到非默认 Region，先设置环境变量：

```bash
export CDK_DEPLOY_REGION=ap-southeast-1
export CDK_DEPLOY_ACCOUNT=<ACCOUNT_ID>
```

部署：

```bash
cdk deploy \
  --context stackName=lark-support-bot \
  --parameters AppID=<your-app-id> \
  --parameters AppSecret=<your-app-secret> \
  --parameters LarkEndpoint=lark \
  --parameters CaseLanguage=zh \
  --parameters SupportRegion=en \
  --parameters UserWhitelist=true \
  --parameters ConfigKey=LarkBotProfile-0 \
  --parameters RefreshInterval=10 \
  --require-approval never
```

CDK 部署会自动完成：
- ✅ 创建所有基础设施
- ✅ 初始化 DynamoDB 配置（含卡片模板、服务列表、严重级别，仅首次部署写入）
- ✅ 启用定时轮询（默认每 10 分钟）
- ✅ 配置 EventBridge 实时推送转发规则

部署完成后记录输出的：
- `msgEventapiEndpoint` — API Gateway URL
- `msgEventRoleArn` — Lambda Role ARN
- `larkbotCaseEventBusArn` — EventBridge Bus ARN

### 5. 创建 Support API IAM Role

```bash
# 从 CloudFormation 获取最新的 Lambda Role ARN（不要用终端里之前打印的旧值）
LAMBDA_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name <your-stack-name> \
  --region <REGION> \
  --query 'Stacks[0].Outputs[?OutputKey==`msgEventRoleArn`].OutputValue' \
  --output text)

echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"

cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "$LAMBDA_ROLE_ARN"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# 首次创建
aws iam create-role \
  --role-name FeishuSupportCaseApiAll \
  --assume-role-policy-document file:///tmp/trust-policy.json

aws iam attach-role-policy \
  --role-name FeishuSupportCaseApiAll \
  --policy-arn arn:aws:iam::aws:policy/AWSSupportAccess
```

> 注意：IAM Role 是全局的。如果同一账号已有此角色（其他 Region 的 stack 创建的），需要把新旧 Lambda Role ARN 都加入 trust policy：
> ```bash
> # 查看当前已有的 trusted ARN
> aws iam get-role --role-name FeishuSupportCaseApiAll \
>   --query 'Role.AssumeRolePolicyDocument.Statement[0].Principal.AWS' --output json
>
> # 把已有的 ARN 和新的 $LAMBDA_ROLE_ARN 一起写入 trust policy
> cat > /tmp/trust-policy.json <<EOF
> {
>   "Version": "2012-10-17",
>   "Statement": [{
>     "Effect": "Allow",
>     "Principal": {"AWS": ["<已有的RoleArn>", "$LAMBDA_ROLE_ARN"]},
>     "Action": "sts:AssumeRole"
>   }]
> }
> EOF
> aws iam update-assume-role-policy --role-name FeishuSupportCaseApiAll --policy-document file:///tmp/trust-policy.json
> ```

### 6. 初始化白名单

```bash
# 查询 bot_config 表名
CONFIG_TABLE=$(aws dynamodb list-tables --region <REGION> \
  --query 'TableNames[?contains(@, `botconfig`)]' --output text)

echo "Config table: $CONFIG_TABLE"

USER_ID="<Lark user_id>"
USER_NAME="<用户名>"

aws dynamodb update-item --region <REGION> --table-name "$CONFIG_TABLE" --key '{"key": {"S": "LarkBotProfile-0"}}' --update-expression "SET user_whitelist.#uid = :name, #r.#uid = :role" --expression-attribute-names '{"#uid": "'"$USER_ID"'", "#r": "role"}' --expression-attribute-values '{":name": {"S": "'"$USER_NAME"'"}, ":role": {"S": "管理员"}}'
```

> Lark user_id 可以从 Lambda 日志中的 `sender_id.user_id` 字段获取。

### 7. 配置 Lark 应用

查询 API Gateway URL：

```bash
aws cloudformation describe-stacks \
  --stack-name <your-stack-name> \
  --region <REGION> \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `msgEventapi`)].OutputValue' \
  --output text
```

输出类似 `https://abc123xyz.execute-api.ap-southeast-1.amazonaws.com/prod/`，在后面加上 `messages` 得到 webhook URL：

```
https://abc123xyz.execute-api.ap-southeast-1.amazonaws.com/prod/messages
```

> 注意：URL 中的 `abc123xyz` 是 API Gateway ID，不是 Lark App ID。

需要配置的位置：
1. **事件订阅 Request URL** — 填上述 URL
2. **回调配置 Request URL** — 填同一个 URL
3. **事件订阅** — 添加 `im.message.receive_v1`
4. **回调订阅** — 添加 `card.action.trigger_v1`
5. **发布应用** — 创建新版本并发布

## Lark 应用配置

### 必需权限

| 权限 | Scope | 用途 |
|------|-------|------|
| Get basic information in contacts | contact:contact.base:readonly | 查用户基本信息 |
| Obtain user ID | contact:user.employee_id:readonly | 创建群时查用户信息 |
| Obtain and update group information | im:chat | 获取和更新群信息 |
| Create group | im:chat:create | 创建工单群 |
| Read and send direct messages and group chat messages | im:message | 读写消息 |
| Obtain user messages mentioning the bot in group | im:message.group_at_msg:readonly | 接收群内 @机器人 消息 |
| Get direct messages sent to bot | im:message.p2p_msg:readonly | 接收私聊消息 |
| Send messages as an app | im:message:send_as_bot | 以机器人身份发消息 |

### 事件订阅

- `im.message.receive_v1` — 接收消息

### 回调订阅

- `card.action.trigger_v1` — 卡片交互

### Request URL

事件订阅和回调配置都填同一个地址：
```
https://<api-id>.execute-api.<region>.amazonaws.com/prod/messages
```

## 权限管控

### 方案一：Lark 应用可见范围（企业账号）

企业账号可在 Lark 开放平台 → 应用 → "Availability" / "Version Management & Release" 里设置哪些部门/用户能看到 Bot。个人账号无此功能。

### 方案二：Bot 内置白名单（推荐）

#### 开启白名单

部署时将 `UserWhitelist` 参数设为 `true`（默认推荐开启）。

#### 管理白名单

在 DynamoDB `bot_config` 表的配置中添加用户：

```json
{
  "user_whitelist": {
    "868ad35b": "tianyue",
    "abc12345": "另一个用户"
  }
}
```

key 是 Lark `user_id`，value 是备注名。不在白名单里的用户会收到无权限提示。

#### Bot 命令管理白名单

管理员可在 Lark 中直接操作（需先在 `role` 字段中设置管理员）：

| 命令 | 说明 |
|------|------|
| 添加白名单 | 添加用户 |
| 删除白名单 | 移除用户 |
| 查看白名单 | 查看当前白名单 |
| 设置管理员 | 设置管理员角色 |

#### 设置管理员

在 DynamoDB `bot_config` 表的 `role` 字段中添加：

```json
{
  "role": {
    "868ad35b": "管理员"
  }
}
```

> 注意：两种方案可叠加使用。个人账号建议用白名单方案。

## 用户操作指南

### 创建工单

1. 和机器人私聊，发送 `SUBJECT 工单标题`
2. 在弹出的卡片中选择账户、服务、严重级别
3. 发送 `DESCRIPTION 问题详细描述`
4. 机器人自动创建 AWS Support Case 并建立工单群

### 更新工单

在工单群里 `@AWS工单机器人 更新内容` 即可同步到 AWS Support Case。

### 关闭工单

在工单群里 `@AWS工单机器人 RESOLVE` 或 `@AWS工单机器人 关闭工单`。

### 其他命令

| 命令 | 说明 |
|------|------|
| 历史 | 查询工单记录 |
| 帮助 / HELP | 查看使用说明 |

## 代码修改记录

相对于原始项目的改动：

1. **移除 Amazon Q 相关代码** — 删除了 q-event Lambda、SQS 队列、Q/Translate/Bedrock IAM 策略
2. **API Gateway 改为 proxy 集成** — 解决 Lark 消息无法传递到 Lambda 的问题
3. **Lambda handler 支持双格式** — 同时处理 API Gateway proxy 事件和 EventBridge 直接调用
4. **修复卡片 key 匹配** — DynamoDB 配置的卡片 key 改为中文（`账户`、`服务`、`响应速度`）
5. **工单标题加用户名** — 通过 chat members API 获取 Lark 用户名，拼入 Case 标题（格式：`[用户名] 标题`）
6. **清理 @mention 占位符** — 群聊消息中的 `@_user_N` 在处理前被清除，确保完整消息内容同步到 Case
7. **新增关闭工单命令** — `RESOLVE` / `关闭工单`
8. **本地编译替代 Docker bundling** — CDK 使用预编译的 Go binary
9. **修复白名单拦截不彻底** — 原代码白名单检查返回 `nil` 后 `Serve` 函数仍会继续执行 case 创建流程，改为返回 error 提前终止
10. **CDK 自动初始化 DynamoDB 配置** — 首次部署时通过 AwsCustomResource 自动写入 bot_config（含卡片模板、30 个服务选项、严重级别等）
11. **CDK 自动配置 EventBridge** — 定时轮询默认启用，aws.support 事件转发规则自动创建（含 IAM Role）
12. **扩展服务列表** — 从 10 个增加到 30 个常用 AWS 服务

## 更新凭证

```bash
# 查询 Secret 名称
aws secretsmanager list-secrets --region <REGION> --query 'SecretList[?contains(Name, `AppID`) || contains(Name, `AppSecret`)].{Name:Name,ARN:ARN}'

# 更新 Lark App ID
aws secretsmanager put-secret-value --region <REGION> \
  --secret-id "<AppIDSecret名称>" \
  --secret-string "<new-app-id>"

# 更新 Lark App Secret
aws secretsmanager put-secret-value --region <REGION> \
  --secret-id "<AppSecretSecret名称>" \
  --secret-string "<new-app-secret>"
```

## 清理资源

```bash
cdk destroy --context stackName=lark-support-bot

# 手动清理 IAM Role（全局资源，确认没有其他 stack 使用后再删）
aws iam detach-role-policy --role-name FeishuSupportCaseApiAll --policy-arn arn:aws:iam::aws:policy/AWSSupportAccess
aws iam delete-role --role-name FeishuSupportCaseApiAll
```
