export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AIResult {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface AIChatParams {
  system: string;
  messages: AIMessage[];
  tools?: AITool[];
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export interface AIProvider {
  chat(params: AIChatParams): Promise<AIResult>;
}
