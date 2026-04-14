package processors

import (
	"encoding/json"
	"fmt"
	"msg-event/config"
	"msg-event/dao"
	"msg-event/model/event"
	"msg-event/services/api"
	"msg-event/utils"
	"os"
	"strings"

	"github.com/sirupsen/logrus"
)

type postProcessor struct {
}

func GetPostProcessor() api.Processor {
	return &postProcessor{}
}

func (r postProcessor) ShouldProcess(e *event.Msg) bool {
	userId := e.Event.Sender.SenderIDs.UserID
	_, ok := config.Conf.UserWhiteListMap[userId]
	if os.Getenv("ENABLE_USER_WHITELIST") == "true" && !ok {
		fromChannelID := e.Event.Message.ChatID
		dao.SendMsgToChannel(fromChannelID, config.Conf.NoPermissionMSG)
		return false
	}
	return true
}

// PostContent represents Lark post (rich text) message structure
type PostContent struct {
	Title   string           `json:"title"`
	Content [][]PostElement  `json:"content"`
}

type PostElement struct {
	Tag      string `json:"tag"`
	Text     string `json:"text,omitempty"`
	ImageKey string `json:"image_key,omitempty"`
	UserID   string `json:"user_id,omitempty"`
	UserName string `json:"user_name,omitempty"`
}

func (r postProcessor) Process(e *event.Msg) error {
	if ok := r.ShouldProcess(e); !ok {
		return fmt.Errorf("user not in whitelist")
	}

	c, err := dao.GetCaseByEvent(e)
	if err != nil {
		logrus.Errorf("get case failed %+v", err)
		return err
	}
	if c == nil || c.CaseID == "" {
		return nil
	}

	post := &PostContent{}
	if err = json.Unmarshal([]byte(e.Event.Message.Content), post); err != nil {
		logrus.Errorf("unmarshal post content failed: %v", err)
		return err
	}

	// Extract text and images from post
	var textParts []string
	var imageKeys []string

	for _, line := range post.Content {
		for _, elem := range line {
			switch elem.Tag {
			case "text":
				text := strings.TrimSpace(elem.Text)
				if text != "" {
					textParts = append(textParts, text)
				}
			case "img":
				if elem.ImageKey != "" {
					imageKeys = append(imageKeys, elem.ImageKey)
				}
			}
		}
	}

	// Strip mention placeholders
	cleanText := stripMentions(strings.Join(textParts, "\n"), e.Event.Message.Mentions)

	// Send text as comment if present
	if cleanText != "" {
		senderID := e.Event.Sender.SenderIDs.UserID
		chatID := e.Event.Message.ChatID
		userName := dao.GetUserName(senderID, chatID)
		comment := fmt.Sprintf("%s\n-- %s via Lark", cleanText, userName)
		_, err = dao.AddComment(c, comment)
		if err != nil {
			logrus.Errorf("add post comment failed: %v", err)
		}
	}

	// Upload images as attachments
	for _, imageKey := range imageKeys {
		data, err := dao.DownloadImage(e.Event.Message.MsgID, imageKey)
		if err != nil {
			logrus.Errorf("download image %s failed: %v", imageKey, err)
			continue
		}
		format := utils.GuessImageFormat(data)
		err = dao.AddAttachmentToCase(c, imageKey+format, data)
		if err != nil {
			logrus.Errorf("upload image %s failed: %v", imageKey, err)
			continue
		}
		logrus.Infof("uploaded image %s to case %s", imageKey, c.DisplayCaseID)
	}

	if len(cleanText) > 0 || len(imageKeys) > 0 {
		dao.SendMsg(c.ChannelID, c.UserID, config.Conf.Ack)
	}

	return nil
}
