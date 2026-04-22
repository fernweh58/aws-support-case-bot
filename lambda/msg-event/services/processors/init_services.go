package processors

import (
	"msg-event/services/api"
	"msg-event/services/handlers"
)

var serverManager map[string]api.Server
var defaultKey = "default"

func InitServices() {
	serverManager = map[string]api.Server{
		"开工单":         handlers.GetOpenCaseServ(),
		"SUBJECT":     handlers.GetOpenCaseServ(),
		"内容":          handlers.GetContentServ(),
		"DESCRIPTION": handlers.GetContentServ(),
		"账户":          handlers.GetAccountServ(),
		"问题":          handlers.GetTitleServ(),
		"响应速度":        handlers.GetServ(),
		"服务":          handlers.GetServiceServ(),
		"RESOLVE":     handlers.GetResolveServ(),
		"关闭工单":        handlers.GetResolveServ(),
		"操作指南":        handlers.GetGuideServ(),
		"GUIDE":       handlers.GetGuideServ(),
		defaultKey:    handlers.GetCommentsServServ(),
	}
}
