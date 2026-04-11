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
import type { PromptPreset } from '$lib/types/prompt-preset';
import { applyRegexScripts } from './regex';
import { matchLorebook } from './lorebook';
import { assemblePromptMessages } from './pipeline';
import { assembleWithPreset } from './prompt-assembler';
import { matchTriggers } from '$lib/core/triggers';
import { applyMutations } from '$lib/core/scripting/mutations';
import { executeScript } from '$lib/core/scripting/bridge';
import type { ScriptMutation } from '$lib/core/scripting/api';
import { EventEmitter } from '$lib/core/events';

export interface SendMessageOptions {
  input: string;
  type: MessageType;
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  messages: Message[];
  characterId?: string;
  preset?: PromptPreset;
}

export interface SendResult {
  userMessage: Message;
  stream: AsyncGenerator<string>;
  onComplete: Promise<Message>;
  abort: () => void;
}

export class ChatEngine {
  private aborted = false;
  readonly events = new EventEmitter();

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

    // 2b. Fire on_user_message triggers
    let triggerScene = options.scene;
    const userTriggers = matchTriggers(options.card.triggers, 'on_user_message', {
      message: processedInput,
      isUserMessage: true,
    });
    for (const trigger of userTriggers) {
      try {
        const scriptResult = await executeScript(trigger.script, {
          variables: triggerScene.variables,
          scene: { location: triggerScene.location, time: triggerScene.time, mood: triggerScene.mood },
          message: processedInput,
          isUserMessage: true,
        });
        if (scriptResult.success) {
          const { scene: newScene } = applyMutations(triggerScene, scriptResult.mutations as ScriptMutation[]);
          triggerScene = newScene;
        }
      } catch {
        // Script execution failed — skip this trigger
      }
    }

    // Fire on_message triggers for user messages
    const onMessageUserTriggers = matchTriggers(options.card.triggers, 'on_message', {
      message: processedInput,
      isUserMessage: true,
    });
    for (const trigger of onMessageUserTriggers) {
      try {
        const scriptResult = await executeScript(trigger.script, {
          variables: triggerScene.variables,
          scene: { location: triggerScene.location, time: triggerScene.time, mood: triggerScene.mood },
          message: processedInput,
          isUserMessage: true,
        });
        if (scriptResult.success) {
          const { scene: newScene } = applyMutations(triggerScene, scriptResult.mutations as ScriptMutation[]);
          triggerScene = newScene;
        }
      } catch {
        // Script execution failed — skip this trigger
      }
    }

    this.events.emit('on_user_message', { message: processedInput });

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
      scene: triggerScene,
      config: options.config,
      lorebookMatches: loreMatches,
    };

    // 6. Run agent onBeforeSend hooks
    for (const agent of this.registry.listAgents()) {
      ctx = await agent.onBeforeSend(ctx);
    }

    // 7-8. Assemble prompt messages (preset-driven or legacy)
    let assembled: Message[];
    let prefillText: string | null = null;

    if (options.preset) {
      const result = assembleWithPreset(options.preset, {
        card: ctx.card,
        scene: ctx.scene,
        messages: ctx.messages,
        lorebookMatches: ctx.lorebookMatches,
      });
      assembled = result.messages;
      prefillText = result.prefill;
    } else {
      const promptBuilder = this.registry.getPromptBuilder('default');
      const systemPrompt = promptBuilder.buildSystemPrompt(ctx.card, ctx.scene);
      assembled = assemblePromptMessages(
        systemPrompt,
        ctx.messages,
        ctx.lorebookMatches,
        ctx.card,
      );
    }

    if (prefillText) {
      assembled.push({
        role: 'assistant',
        content: prefillText,
        type: 'dialogue',
        timestamp: 0,
      });
    }

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

      // 11b. Fire on_ai_message triggers
      const aiTriggers = matchTriggers(capturedCtx.card.triggers, 'on_ai_message', {
        message: processed,
        isUserMessage: false,
      });
      for (const trigger of aiTriggers) {
        try {
          const scriptResult = await executeScript(trigger.script, {
            variables: capturedCtx.scene.variables,
            scene: { location: capturedCtx.scene.location, time: capturedCtx.scene.time, mood: capturedCtx.scene.mood },
            message: processed,
            isUserMessage: false,
          });
          if (scriptResult.success) {
            // AI-trigger mutations are collected but don't change the current response
            applyMutations(capturedCtx.scene, scriptResult.mutations as ScriptMutation[]);
          }
        } catch {
          // Script execution failed — skip
        }
      }

      // Fire on_message triggers for AI messages
      const onMessageAiTriggers = matchTriggers(capturedCtx.card.triggers, 'on_message', {
        message: processed,
        isUserMessage: false,
      });
      for (const trigger of onMessageAiTriggers) {
        try {
          await executeScript(trigger.script, {
            variables: capturedCtx.scene.variables,
            scene: { location: capturedCtx.scene.location, time: capturedCtx.scene.time, mood: capturedCtx.scene.mood },
            message: processed,
            isUserMessage: false,
          });
        } catch {
          // Script execution failed — skip
        }
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
