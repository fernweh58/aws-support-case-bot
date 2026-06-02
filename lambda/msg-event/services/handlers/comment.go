package handlers

import (
	"errors"
	"fmt"
	"msg-event/config"
	"msg-event/dao"
	"msg-event/model/event"
	"msg-event/services/api"
	"strings"

	"github.com/sirupsen/logrus"
)

type commentsServ struct {
}

func GetCommentsServServ() api.Server {
	return &commentsServ{}
}

func (s *commentsServ) Handle(e *event.Msg, str string) (c *dao.Case, err error) {
	c, err = dao.GetCaseByEvent(e)
	if err != nil {
		logrus.Errorf("get case failed %+v", err)
		return nil, errors.New(config.CaseNotExisted)
	}
	cazeID := strings.Trim(c.CaseID, " ")
	if cazeID == "" || c.Type == dao.TYPE_OPEN_CASE {
		return nil, errors.New(dao.FormatMsg(c))
	}

	chatID := e.Event.Message.ChatID
	senderID := e.Event.Sender.SenderIDs.UserID

	// Check if this is a confirmation for a pending authorization message
	upperStr := strings.ToUpper(strings.TrimSpace(str))
	if (upperStr == "确认" || upperStr == "CONFIRM") && c.PendingAuthMsg != "" {
		// Only security reviewers can confirm
		if _, ok := config.Conf.SecurityReviewers[senderID]; !ok {
			dao.SendMsg(chatID, senderID, "⚠️ 仅安全团队成员可以确认授权消息。")
			return c, nil
		}
		// Security reviewer confirmed, forward the original authorization message
		userName := dao.GetUserName(senderID, chatID)
		comment := fmt.Sprintf("%s\n-- %s via Lark", c.PendingAuthMsg, userName)
		c, err = dao.AddComment(c, comment)
		if err != nil {
			logrus.Errorf("add comment failed %+v", err)
			return nil, err
		}
		c.PendingAuthMsg = ""
		dao.UpsertCase(c)
		dao.SendMsg(chatID, senderID, "✅ 授权消息已转发至 AWS Support。")
		return c, nil
	}

	// Review message with Bedrock
	result, err := dao.ReviewMessage(str)
	if err != nil {
		logrus.Warnf("Bedrock review failed, forwarding without review: %v", err)
		// If Bedrock fails, fall through to normal forwarding
	} else if result != nil && result.IsAuthorization {
		// Block and require security reviewer confirmation
		logrus.Infof("Authorization message detected: %s", result.Reason)
		c.PendingAuthMsg = str
		dao.UpsertCase(c)

		dao.SendMsg(chatID, senderID,
			"⚠️ 检测到该消息包含授权/权限授予内容。请安全同事在本群 @我 回复「确认」或「CONFIRM」后，消息将转发至 AWS Support。")
		return c, nil
	}

	// Normal comment flow
	userName := dao.GetUserName(senderID, chatID)
	comment := fmt.Sprintf("%s\n-- %s via Lark", str, userName)

	c, err = dao.AddComment(c, comment)
	if err != nil {
		logrus.Errorf("add comment failed %+v", err)
		return nil, err
	}

	dao.SendMsg(c.ChannelID, c.UserID, config.Conf.Ack)

	if c.Status == dao.STATUS_CLOSE {
		c.Status = dao.STATUS_OPEN
		logrus.Infof("change the case status to OPEN for re-open case %v", c.Status)
	}

	dao.UpsertCase(c)

	return c, nil
}

func (s *commentsServ) ShouldHandle(e *event.Msg) bool {
	return true
}
