package handlers

import (
	"msg-event/dao"
	"msg-event/model/event"
	"msg-event/services/api"
)

const guideMsg = "欢迎使用 AWS 工单机器人！\n\n创建工单步骤：\n1. 发送 SUBJECT+工单标题 开始\n2. 在卡片中选择服务和严重级别\n3. 发送 DESCRIPTION+问题描述 提交\n\n工单群操作：\n- @机器人 发消息更新工单\n- @机器人 RESOLVE 关闭工单\n\n其他命令：操作指南 | GUIDE"

type guideServ struct{}

func GetGuideServ() api.Server {
	return &guideServ{}
}

func (s *guideServ) Handle(e *event.Msg, _ string) (c *dao.Case, err error) {
	chatID := e.Event.Message.ChatID
	content := `{"text":"欢迎使用 AWS 工单机器人！\n\n创建工单步骤：\n1. 发送「SUBJECT 工单标题」开始（例：SUBJECT 我的EC2无法启动）\n2. 在卡片中选择服务和严重级别\n3. 发送「DESCRIPTION 问题描述」提交\n4. 工单创建成功，自动创建相关工单群\n\n工单群操作：\n- @机器人 发消息更新工单\n- @机器人 RESOLVE 关闭工单\n\n其他命令：操作指南 | GUIDE"}`
	dao.SendRawMsg(chatID, "text", content)
	return nil, nil
}

func (s *guideServ) ShouldHandle(e *event.Msg) bool {
	return true
}
