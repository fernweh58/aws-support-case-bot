package handlers

import (
	"errors"
	"msg-event/dao"
	"msg-event/model/event"
	"msg-event/services/api"

	"github.com/sirupsen/logrus"
)

type resolveServ struct {
}

func GetResolveServ() api.Server {
	return &resolveServ{}
}

func (s *resolveServ) Handle(e *event.Msg, str string) (c *dao.Case, err error) {
	c, err = dao.GetCaseByEvent(e)
	if err != nil {
		logrus.Errorf("get case failed %+v", err)
		return nil, errors.New("No case found to resolve")
	}
	if c.CaseID == "" {
		return nil, errors.New("No case found to resolve")
	}

	err = dao.ResolveCase(c)
	if err != nil {
		logrus.Errorf("resolve case failed %+v", err)
		return nil, err
	}

	c.Status = dao.STATUS_CLOSE
	dao.UpsertCase(c)
	dao.SendMsg(c.ChannelID, c.UserID, "Case "+c.DisplayCaseID+" has been resolved.")
	return c, nil
}

func (s *resolveServ) ShouldHandle(e *event.Msg) bool {
	return true
}
