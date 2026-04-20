package processors

import (
	"msg-event/dao"
	"msg-event/model/event"
	"msg-event/services/api"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/support/types"
	"github.com/sirupsen/logrus"
)

type refreshCommentProcessor struct {
}

func (r refreshCommentProcessor) ShouldProcess(e *event.Msg) bool {
	return true
}

func GetRefreshCommentProcessor() api.Processor {
	return &refreshCommentProcessor{}
}

func (r refreshCommentProcessor) Process(e *event.Msg) error {
	logrus.Infof("Ready to refresh comment...")
	// Wait for AWS Support API eventual consistency
	time.Sleep(15 * time.Second)
	err := RefreshComments()
	if err != nil {
		logrus.Errorf("Refresh comment failed %s", err)
	}
	logrus.Infof("Refresh comments complated")
	return err
}

func filterAWSReplies(comments []types.Communication) []types.Communication {
	var filtered []types.Communication
	for _, c := range comments {
		if c.SubmittedBy != nil &&
			!strings.Contains(*c.SubmittedBy, "SupportCaseApiAll") {
			filtered = append(filtered, c)
		}
	}
	return filtered
}

func RefreshComments() error {
	cs, err := dao.GetProcessingCases()
	if err != nil {
		logrus.Errorf("refresh failed to get cases %s", err)
		return err
	}

	for _, c := range cs {
		oldCommentTime := c.LastCommentTime

		comments, err := dao.GetCaseComments(c, c.LastCommentTime)
		if err != nil {
			logrus.Errorf("failed to get all comments %s", err)
			continue
		}

		awscase, err := dao.GetAWSCase(c)
		if err != nil {
			logrus.Errorf("failed to get aws case %s", err)
			continue
		}
		if *awscase.Cases[0].Status == "resolved" {
			c.Status = dao.STATUS_CLOSE
		}

		newComments := filterAWSReplies(comments)

		if len(newComments) > 0 {
			c.Comments = newComments
			c.LastCommentTime = time.Now()
			// Optimistic lock: only update if last_comment_time hasn't changed
			updated, err := dao.ConditionalUpsertCase(c, oldCommentTime)
			if err != nil {
				logrus.Errorf("conditional update failed %s", err)
				continue
			}
			if !updated {
				logrus.Infof("case %s already processed by another instance, skipping", c.DisplayCaseID)
				continue
			}
			_, err = dao.SendMsg(c.ChannelID, c.UserID, dao.FormatComments(newComments))
			if err != nil {
				logrus.Errorf("failed to send comments %s", err)
				continue
			}
		} else if c.Status == dao.STATUS_CLOSE {
			_, err := dao.UpsertCase(c)
			if err != nil {
				logrus.Errorf("update case status failed %s", err)
				continue
			}
		}
	}
	return nil
}
