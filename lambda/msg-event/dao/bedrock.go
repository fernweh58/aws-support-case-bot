package dao

import (
	"encoding/json"
	"fmt"
	"msg-event/config"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/context"
)

const defaultModelID = "global.anthropic.claude-sonnet-4-6"

const systemPrompt = `You are a security reviewer for AWS Support case messages. Your job is to determine if a message contains authorization or permission grants.

A message is considered an "authorization grant" if it:
- Grants consent for AWS engineers to access customer data, diagnostics, logs, or systems
- Approves diagnostic access from outside the AWS Region
- Contains phrases like "I approve", "I agree", "I consent", "I authorize", "同意", "授权", "批准"
- Responds to a request for permission to perform manual diagnostics, access data, or perform operations on customer resources

Respond with ONLY a JSON object:
- {"is_authorization": true, "reason": "<brief explanation>"} if the message grants authorization
- {"is_authorization": false, "reason": ""} if it does not`

type BedrockMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type BedrockRequest struct {
	AnthropicVersion string           `json:"anthropic_version"`
	MaxTokens        int              `json:"max_tokens"`
	System           string           `json:"system"`
	Messages         []BedrockMessage `json:"messages"`
}

type BedrockContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type BedrockResponse struct {
	Content []BedrockContentBlock `json:"content"`
}

type ReviewResult struct {
	IsAuthorization bool   `json:"is_authorization"`
	Reason          string `json:"reason"`
}

func ReviewMessage(text string) (*ReviewResult, error) {
	cfg, err := awsconfig.LoadDefaultConfig(context.Background())
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	client := bedrockruntime.NewFromConfig(cfg)

	reqBody := BedrockRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        256,
		System:           systemPrompt,
		Messages: []BedrockMessage{
			{Role: "user", Content: text},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	resp, err := client.InvokeModel(context.Background(), &bedrockruntime.InvokeModelInput{
		ModelId:     strPtr(getModelID()),
		ContentType: strPtr("application/json"),
		Body:        body,
	})
	if err != nil {
		logrus.Errorf("Bedrock InvokeModel failed: %v", err)
		return nil, err
	}

	var bedrockResp BedrockResponse
	if err := json.Unmarshal(resp.Body, &bedrockResp); err != nil {
		return nil, err
	}

	if len(bedrockResp.Content) == 0 {
		return &ReviewResult{IsAuthorization: false}, nil
	}

	var result ReviewResult
	if err := json.Unmarshal([]byte(bedrockResp.Content[0].Text), &result); err != nil {
		logrus.Warnf("Failed to parse Bedrock response as JSON: %s", bedrockResp.Content[0].Text)
		return &ReviewResult{IsAuthorization: false}, nil
	}

	return &result, nil
}

func strPtr(s string) *string { return &s }

func getModelID() string {
	if config.Conf != nil && config.Conf.BedrockModelID != "" {
		return config.Conf.BedrockModelID
	}
	return defaultModelID
}
