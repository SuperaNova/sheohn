import { getToolName, isToolUIPart } from 'ai';
import { describeResponse, isInfraStatus } from '../src/lib/eval-infra';
import {
  getAssistantText,
  parseAgentResponse,
} from '../tests/eval/parseAgentResponse';

const TARGET_URL = process.env.REDTEAM_TARGET_URL ?? 'http://localhost:4397';

export default class ChatProvider {
  id(): string {
    return 'sheohn-chat';
  }

  async callApi(prompt: string) {
    let response: Response;
    try {
      response = await fetch(`${TARGET_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              id: 'redteam-case',
              role: 'user',
              parts: [{ type: 'text', text: prompt }],
            },
          ],
        }),
      });
    } catch (e) {
      return { error: `[infra] request failed: ${(e as Error).message}` };
    }

    const sseText = await response.text();
    if (isInfraStatus(response.status)) {
      return { error: `[infra] ${describeResponse(response.status, sseText)}` };
    }
    if (response.status !== 200) {
      return {
        error: `unexpected response: ${describeResponse(response.status, sseText)}`,
      };
    }

    try {
      const message = await parseAgentResponse(sseText, response.status);
      const toolCalls = message.parts.filter(isToolUIPart).map((part) => ({
        name: getToolName(part),
        input: (part as { input?: unknown }).input,
      }));
      return {
        output: getAssistantText(message),
        metadata: { toolCalls },
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
}
