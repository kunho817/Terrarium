/**
 * ChatEngine — orchestrates the full chat pipeline.
 * Uses PluginRegistry to access providers, prompt builders, and agents.
 * Calls provider.chat() (not chatWithCard) because the engine handles prompt assembly.
 */

import type {
  Message,
  MessageType,
  CharacterCard,
  SceneState,
  UserConfig,
  ChatContext,
} from '$lib/types';
import type { PluginRegistry } from '$lib/plugins/registry';
import { applyRegexScripts } from './regex';
import { matchLorebook } from './lorebook';
import { assemblePromptMessages } from './pipeline';

export interface SendMessageOptions {
  input: string;
  type: MessageType;
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  messages: Message[];
  characterId?: string;
}

export interface SendResult {
  userMessage: Message;
  stream: AsyncGenerator<string>;
  onComplete: Promise<Message>;
  abort: () => void;
}

export class ChatEngine {
  private aborted = false;

  constructor(private registry: PluginRegistry) {}

  async send(options: SendMessageOptions): Promise<SendResult> {
    this.aborted = false;

    // 1. Apply modify_input regex to user input
    const processedInput = applyRegexScripts(
      options.input,
      options.card.regexScripts,
      'modify_input',
    );

    // 2. Create user message
    const userMessage: Message = {
      role: 'user',
      content: processedInput,
      type: options.type,
      characterId: options.characterId,
      timestamp: Date.now(),
    };

    // 3. Build message list with new user message
    const allMessages = [...options.messages, userMessage];

    // 4. Match lorebook
    const loreMatches = matchLorebook(
      allMessages,
      options.card.lorebook,
      options.card.loreSettings,
    );

    // 5. Build ChatContext
    let ctx: ChatContext = {
      messages: allMessages,
      card: options.card,
      scene: options.scene,
      config: options.config,
      lorebookMatches: loreMatches,
    };

    // 6. Run agent onBeforeSend hooks
    for (const agent of this.registry.listAgents()) {
      ctx = await agent.onBeforeSend(ctx);
    }

    // 7. Build system prompt via PromptBuilderPlugin
    const promptBuilder = this.registry.getPromptBuilder('default');
    const systemPrompt = promptBuilder.buildSystemPrompt(ctx.card, ctx.scene);

    // 8. Assemble prompt messages
    const assembled = assemblePromptMessages(
      systemPrompt,
      ctx.messages,
      ctx.lorebookMatches,
      ctx.card,
    );

    // 9. Set up streaming with completion promise
    let resolveComplete!: (msg: Message) => void;
    const onComplete = new Promise<Message>((resolve) => {
      resolveComplete = resolve;
    });

    const self = this;
    const capturedCtx = ctx;
    const capturedConfig = options.config;
    const capturedCharacterId = options.characterId;

    async function* tokenStream(): AsyncGenerator<string> {
      const provider = self.registry.getProvider(capturedConfig.providerId);
      let fullResponse = '';

      try {
        for await (const token of provider.chat(assembled, capturedConfig)) {
          if (self.aborted) break;
          fullResponse += token;
          yield token;
        }
      } catch {
        // Provider error — use accumulated tokens
      }

      // 10. Apply modify_output regex
      let processed = applyRegexScripts(
        fullResponse,
        capturedCtx.card.regexScripts,
        'modify_output',
      );

      // 11. Run agent onAfterReceive hooks
      for (const agent of self.registry.listAgents()) {
        processed = await agent.onAfterReceive(capturedCtx, processed);
      }

      // 12. Build final assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: processed,
        type: 'dialogue',
        characterId: capturedCharacterId,
        timestamp: Date.now(),
        generationInfo: {
          model: capturedConfig.model,
        },
      };

      resolveComplete(assistantMessage);
    }

    return {
      userMessage,
      stream: tokenStream(),
      abort: () => {
        self.aborted = true;
      },
      onComplete,
    };
  }
}

/** Helper: consume a SendResult's stream and return tokens + final message. */
export async function consumeStream(
  result: SendResult,
): Promise<{ tokens: string[]; message: Message }> {
  const tokens: string[] = [];
  for await (const token of result.stream) {
    tokens.push(token);
  }
  const message = await result.onComplete;
  return { tokens, message };
}
