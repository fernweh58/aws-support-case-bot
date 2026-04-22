# Lark AWS Support Case Bot

通过 Lark 聊天机器人创建、查看、更新和关闭 AWS Support Case。

## 架构

```
Lark 用户 → Lark Server → Global Accelerator (固定 IP) → ALB → Lambda (Go ARM64)
                                                                    ├── DynamoDB (配置/工单/审计)
                                                                    ├── Secrets Manager (Lark 凭证)
                                                                    ├── AWS Support API (创建/查询工单)
                                                                    └── EventBridge (实时推送 + 定时轮询)
```

## 部署方式

### CloudFormation 模板部署

1. 编译 Go Lambda 代码
2. 申请 ACM 公共证书（需要自己的域名）
3. 创建 Secrets Manager secrets（App ID、App Secret）
4. 创建 Support API IAM Role
5. 上传 `cfn-deploy/` 中的文件到 S3
6. 通过 CloudFormation 部署 `template.yaml`
7. 部署后：更新 Support Role 信任策略、添加 DNS CNAME、初始化白名单
8. 配置 Lark 应用（webhook URL、事件订阅、权限）

详细步骤见部署指南文档。

## 部署后配置

1. **更新 Support Role 信任策略** — 指向 Lambda 执行角色
2. **DNS CNAME** — 自定义域名指向 Global Accelerator DNS
3. **IP 白名单** — Global Accelerator 提供 2 个固定 Anycast IP
4. **初始化白名单** — 在 DynamoDB bot_config 表中添加用户
5. **Lark 应用** — 设置 webhook URL、事件订阅、回调订阅、权限

## 用户操作

| 命令 | 说明 |
|------|------|
| `操作指南` / `GUIDE` | 查看使用指南 |
| `SUBJECT 标题` | 开始创建工单 |
| `DESCRIPTION 描述` | 提交工单内容 |
| `@机器人 消息` | 在工单群中更新工单 |
| `@机器人 RESOLVE` | 关闭工单 |

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
