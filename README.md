# Lark AWS Support Case Bot

通过 Lark 聊天机器人创建、查看、更新和关闭 AWS Support Case。

## 架构

```
Lark 用户 → API Gateway → Lambda (Go ARM64) → AWS Support API
                                ├── DynamoDB (配置/工单/审计)
                                ├── Secrets Manager (Lark 凭证)
                                └── EventBridge (实时推送 + 定时轮询)
```

## 部署方式

支持两种部署方式：

### 方式一：CloudFormation 模板直接部署

适合不想安装 CDK/Node.js 的场景。详见 `cfn-deploy/` 目录。

1. 手动创建 Secrets Manager secrets（App ID、App Secret）
2. 手动创建 Support API IAM Role
3. 上传 `cfn-deploy/` 中的文件到 S3
4. 通过 CloudFormation Console 部署 `template.yaml`

### 方式二：CDK 部署

```bash
npm install
cd lambda/msg-event && GOARCH=arm64 GOOS=linux go build -tags lambda.norpc -o bootstrap . && cd ../..
cdk deploy --context stackName=lark-support-bot
```

## 部署后配置

1. **创建 Support Role** — 创建 IAM Role 并附加 `AWSSupportAccess`，信任策略指向 Lambda 执行角色
2. **配置 Lark 应用** — 设置事件订阅 URL、添加 `im.message.receive_v1` 事件和 `card.action.trigger_v1` 回调
3. **初始化白名单**（可选）— 在 DynamoDB bot_config 表中添加用户

## 用户操作

| 命令 | 说明 |
|------|------|
| `SUBJECT 标题` | 开始创建工单 |
| `DESCRIPTION 描述` | 提交工单内容 |
| `@机器人 消息` | 在工单群中更新工单 |
| `@机器人 RESOLVE` | 关闭工单 |
| `帮助` / `HELP` | 查看使用说明 |

## Lark 应用权限

- `im:message.p2p_msg:readonly` — 接收私聊消息
- `im:message.group_at_msg:readonly` — 接收群内 @消息
- `im:message:send_as_bot` — 发送消息
- `im:chat:create` — 创建工单群
- `im:message:readonly` — 读取消息内容
- `contact:contact.base:readonly` — 查询用户信息

## 清理

```bash
# CDK 部署
cdk destroy --context stackName=lark-support-bot

# CFN 部署
# 在 CloudFormation Console 删除 stack，然后手动删除 Secrets 和 IAM Role
```
