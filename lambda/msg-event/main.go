package main

import (
	"context"
	"encoding/json"
	"msg-event/crypto"
	"msg-event/dao"
	"msg-event/model/event"
	"msg-event/services"
	"runtime/debug"
	"sync"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/sirupsen/logrus"
)

type httpEvent struct {
	HTTPMethod string `json:"httpMethod"`
	Body       string `json:"body"`
}

type encryptedCheck struct {
	Encrypt string `json:"encrypt"`
}

var (
	cachedEncryptKey string
	encryptKeyOnce   sync.Once
)

func getEncryptKeyCached() string {
	encryptKeyOnce.Do(func() {
		dao.SetupConfig()
		key, err := dao.GetEncryptKey()
		if err != nil {
			logrus.Errorf("get encrypt key err %v", err)
			return
		}
		cachedEncryptKey = key
		if key != "" {
			logrus.Info("encrypt key loaded and cached")
		}
	})
	return cachedEncryptKey
}

func HandleRequest(ctx context.Context, raw json.RawMessage) (interface{}, error) {
	defer func() {
		if r := recover(); r != nil {
			logrus.Infof("panic is %v", string(debug.Stack()))
		}
	}()

	logrus.Infof("event is %s", string(raw))

	var he httpEvent
	if err := json.Unmarshal(raw, &he); err == nil && he.HTTPMethod != "" {
		if he.HTTPMethod != "POST" {
			return events.ALBTargetGroupResponse{StatusCode: 200, Body: `{"ok":true}`}, nil
		}

		body := []byte(he.Body)

		// Decrypt if body contains "encrypt" field
		var ec encryptedCheck
		if json.Unmarshal(body, &ec) == nil && ec.Encrypt != "" {
			encryptKey := getEncryptKeyCached()
			if encryptKey != "" {
				decrypted, err := crypto.Decrypt(encryptKey, body)
				if err != nil {
					logrus.Errorf("decrypt body err %v", err)
					return events.ALBTargetGroupResponse{StatusCode: 400}, nil
				}
				body = decrypted
			}
		}

		e := &event.Msg{}
		if err := json.Unmarshal(body, e); err != nil {
			logrus.Errorf("unmarshal body err %v", err)
			return events.ALBTargetGroupResponse{StatusCode: 400}, nil
		}
		r, err := services.Serve(ctx, e)
		if err != nil {
			logrus.Errorf("handle err %v", err)
		}
		respBody, _ := json.Marshal(r)
		return events.ALBTargetGroupResponse{
			StatusCode: 200,
			Headers:    map[string]string{"Content-Type": "application/json"},
			Body:       string(respBody),
		}, nil
	}

	// Direct invocation (EventBridge)
	e := &event.Msg{}
	if err := json.Unmarshal(raw, e); err != nil {
		logrus.Errorf("unmarshal direct event err %v", err)
		return nil, nil
	}
	r, err := services.Serve(ctx, e)
	if err != nil {
		logrus.Errorf("handle err %v", err)
	}
	return r, nil
}

func main() {
	lambda.Start(HandleRequest)
}
