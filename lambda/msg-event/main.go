package main

import (
	"context"
	"encoding/json"
	"msg-event/model/event"
	"msg-event/services"
	"runtime/debug"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/sirupsen/logrus"
)

func HandleRequest(ctx context.Context, raw json.RawMessage) (interface{}, error) {
	defer func() {
		if r := recover(); r != nil {
			logrus.Infof("panic is %v", string(debug.Stack()))
		}
	}()

	logrus.Infof("event is %s", string(raw))

	// Try API Gateway proxy format first
	var proxyReq events.APIGatewayProxyRequest
	if err := json.Unmarshal(raw, &proxyReq); err == nil && proxyReq.HTTPMethod != "" {
		e := &event.Msg{}
		if err := json.Unmarshal([]byte(proxyReq.Body), e); err != nil {
			logrus.Errorf("unmarshal body err %v", err)
			return events.APIGatewayProxyResponse{StatusCode: 400}, nil
		}
		r, err := services.Serve(ctx, e)
		if err != nil {
			logrus.Errorf("handle err %v", err)
		}
		body, _ := json.Marshal(r)
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    map[string]string{"Content-Type": "application/json"},
			Body:       string(body),
		}, nil
	}

	// Otherwise treat as direct invocation (EventBridge)
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
