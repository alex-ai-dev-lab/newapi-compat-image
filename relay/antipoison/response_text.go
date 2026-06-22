package antipoison

import "github.com/QuantumNous/new-api/dto"

type responseTextField struct {
	text string
	set  func(string)
}

func firstResponseTextField(fields []responseTextField, empty func(string) bool) (responseTextField, bool) {
	for _, field := range fields {
		if empty(field.text) {
			continue
		}
		return field, true
	}
	return responseTextField{}, false
}

func openAIResponseTextFields(resp *dto.OpenAITextResponse) []responseTextField {
	if resp == nil {
		return nil
	}
	fields := make([]responseTextField, 0, len(resp.Choices))
	for i := range resp.Choices {
		msg := &resp.Choices[i].Message
		if !msg.IsStringContent() {
			continue
		}
		fields = append(fields, responseTextField{
			text: msg.StringContent(),
			set:  msg.SetStringContent,
		})
	}
	return fields
}

func responsesTextFields(resp *dto.OpenAIResponsesResponse, textOnly bool) []responseTextField {
	if resp == nil {
		return nil
	}
	var fields []responseTextField
	for i := range resp.Output {
		for j := range resp.Output[i].Content {
			if textOnly && resp.Output[i].Content[j].Type != "text" {
				continue
			}
			outputIndex, contentIndex := i, j
			fields = append(fields, responseTextField{
				text: resp.Output[outputIndex].Content[contentIndex].Text,
				set: func(text string) {
					resp.Output[outputIndex].Content[contentIndex].Text = text
				},
			})
		}
	}
	return fields
}

func claudeResponseTextFields(resp *dto.ClaudeResponse, textOnly bool) []responseTextField {
	if resp == nil {
		return nil
	}
	fields := make([]responseTextField, 0, len(resp.Content))
	for i := range resp.Content {
		if textOnly && resp.Content[i].Type != "text" {
			continue
		}
		contentIndex := i
		fields = append(fields, responseTextField{
			text: resp.Content[contentIndex].GetText(),
			set: func(text string) {
				resp.Content[contentIndex].SetText(text)
			},
		})
	}
	return fields
}
