# Lark AWS Support Case Bot

通过 Lark 聊天机器人创建、查看、更新和关闭 AWS Support Case。支持 Bedrock AI 审核授权类消息，防止用户误操作授予权限。

## 架构

```
Lark 用户 → Lark Server → ALB (Lark IP 白名单) → Lambda (Go ARM64)
                                                        ├── DynamoDB (配置/工单/审计)
                                                        ├── Secrets Manager (Lark 凭证)
                                                        ├── AWS Support API (创建/查询工单)
                                                        ├── Bedrock Claude Sonnet 4.6 (授权消息审核)
                                                        └── EventBridge (实时推送 + 定时轮询)
```

## 功能

- 通过 Lark 私聊创建 AWS Support Case（选择服务、严重级别）
- 自动创建工单群，群内 @bot 消息同步到 AWS Support
- AWS Support 工程师回复自动推送到工单群
- **AI 审核**：检测授权/权限授予类消息，要求用户确认安全团队同意后才转发
- 支持图片和文件附件

## 部署方式

### 前置条件

- AWS 账号（需要 Business/Enterprise Support Plan）
- 部署 Region 推荐 **ap-southeast-1** 或 **ap-northeast-1**（离 Lark 服务器近，避免卡片回调 3 秒超时）
- Bedrock 模型访问：在部署 Region 开通 Claude Sonnet 4.6
- Lark 开放平台自定义应用（获取 App ID 和 App Secret）
- 自己的域名（用于 ACM 公共证书）

### CloudFormation 模板部署

1. 编译 Go Lambda 代码
2. 申请 ACM 公共证书（需要自己的域名，域名需匹配 Lark 回调 URL）
3. 创建 Secrets Manager secrets（App ID、App Secret）
4. 创建 Support API IAM Role
5. 上传 `cfn-deploy/` 中的文件到 S3
6. 通过 CloudFormation 部署 `template.yaml`
7. 部署后：更新 Support Role 信任策略、添加 DNS CNAME、初始化白名单
8. 配置 Lark 应用（事件订阅 URL、卡片请求 URL、权限）

详细步骤见部署指南文档。

## 部署后配置

1. **更新 Support Role 信任策略** — 指向 Lambda 执行角色
2. **DNS CNAME** — 自定义域名指向 ALB DNS name
3. **初始化白名单** — 在 DynamoDB bot_config 表中添加用户
4. **Lark 应用** — 设置事件订阅 URL、卡片请求 URL、权限

## 安全

- ALB 安全组仅允许 Lark 服务器出口 IP 访问（入站白名单）
- 授权类消息通过 Bedrock AI 审核，需用户二次确认才转发

## 用户操作

| 命令 | 说明 |
|------|------|
| `操作指南` / `GUIDE` | 查看使用指南 |
| `SUBJECT 标题` | 开始创建工单 |
| `DESCRIPTION 描述` | 提交工单内容 |
| `@机器人 消息` | 在工单群中更新工单 |
| `@机器人 RESOLVE` | 关闭工单 |
| `@机器人 确认` / `CONFIRM` | 确认转发被拦截的授权消息 |

## Lark 应用权限

- `im:message.p2p_msg:readonly` — 接收私聊消息
- `im:message.group_at_msg:readonly` — 接收群内 @消息
- `im:message:send_as_bot` — 发送消息
- `im:chat:create` — 创建工单群
- `im:message:readonly` — 读取消息内容
- `contact:contact.base:readonly` — 查询用户信息

## 清理

```bash
# 删除 CloudFormation stack
# 手动删除：Secrets、IAM Role、ACM 证书、DNS 记录、S3 文件
```
