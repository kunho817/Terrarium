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
  LorebookEntry,
  TriggerEvent,
} from '$lib/types';
import type { WorldCard } from '$lib/types/world';
import type { ChatMetadata } from '$lib/types/plugin';
import type { PluginRegistry } from '$lib/plugins/registry';
import type { PromptPreset } from '$lib/types/prompt-preset';
import type { UserPersona } from '$lib/types/persona';
import { applyRegexScripts } from './regex';
import { TriggerExecutor } from '../lua/trigger-executor';
import { matchLorebook } from './lorebook';
import { assemblePromptMessages } from './pipeline';
import { assembleWithPreset } from './prompt-assembler';
import { matchTriggers } from '$lib/core/triggers';
import { applyMutations } from '$lib/core/scripting/mutations';
import { executeScript } from '$lib/core/scripting/bridge';
import type { ScriptMutation } from '$lib/core/scripting/api';
import { EventEmitter } from '$lib/core/events';
import { AgentPipeline } from '../agents/agent-pipeline';
import {
	startPipeline,
	updateStep,
	resetPipeline,
} from '$lib/stores/agent-progress';
import { makeSessionId, makeCharacterId } from '$lib/types/branded';
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';

function buildWorldCharacterLore(worldCard: WorldCard): LorebookEntry[] {
  return worldCard.characters.map(char => {
    const parts: string[] = [];
    parts.push(`[Character: ${char.name}]`);
    if (char.description) parts.push(char.description);
    if (char.personality) parts.push(`Personality: ${char.personality}`);
    if (char.exampleMessages) parts.push(`Example Messages:\n${char.exampleMessages}`);
    if (char.avatar) parts.push(`Avatar: ${char.avatar}`);
    parts.push('');

    return {
      id: `__world_char_${char.id}`,
      name: char.name,
      keywords: [char.name.toLowerCase()],
      caseSensitive: false,
      content: parts.join('\n'),
      position: 'before_char' as const,
      priority: 0,
      enabled: true,
      scanDepth: worldCard.loreSettings.scanDepth,
      scope: 'global' as const,
      mode: 'normal' as const,
      constant: true,
      category: 'character' as const,
    };
  });
}

interface TriggerExecContext {
  triggers: import('$lib/types/trigger').Trigger[];
  event: TriggerEvent;
  message: string;
  isUserMessage: boolean;
  scene: import('$lib/types/scene').SceneState;
}



async function executeTriggers(
  ctx: TriggerExecContext,
): Promise<{ scene: import('$lib/types/scene').SceneState }> {
  let currentScene = ctx.scene;

  const triggers = matchTriggers(ctx.triggers, ctx.event, {
    message: ctx.message,
    isUserMessage: ctx.isUserMessage,
  });

  for (const trigger of triggers) {
    try {
      const scriptResult = await executeScript(trigger.script, {
        variables: currentScene.variables,
        scene: { location: currentScene.location, time: currentScene.time, mood: currentScene.mood },
        message: ctx.message,
        isUserMessage: ctx.isUserMessage,
      });
      if (scriptResult.success) {
        const { scene: newScene } = applyMutations(currentScene, scriptResult.mutations as ScriptMutation[]);
        currentScene = newScene;
      }
    } catch {
    }
  }

  return { scene: currentScene };
}

export interface SendMessageOptions {
  input: string;
  type: MessageType;
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  messages: Message[];
  characterId?: string;
  sessionId?: string;
  preset?: PromptPreset;
  persona?: UserPersona;
  worldCard?: WorldCard;
  imageAutoGenerate?: boolean;
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
  private pipeline = new AgentPipeline();

  constructor(private registry: PluginRegistry) {}

  async send(options: SendMessageOptions): Promise<SendResult> {
    this.aborted = false;

    const processedInput = applyRegexScripts(
      options.input,
      options.card.regexScripts,
      'modify_input',
    );

    const userMessage: Message = {
      role: 'user',
      content: processedInput,
      type: options.type,
      characterId: options.characterId,
      timestamp: Date.now(),
    };

    let triggerScene = options.scene;
    if (options.card.triggers?.length > 0) {
      try {
        const executor = new TriggerExecutor(options.card.triggers, triggerScene.variables);
        const result = await executor.execute('on_user_message');
        triggerScene = { ...triggerScene, variables: result.variables };
      } catch {
      }
    }
    const userTrigResult = await executeTriggers({
      triggers: options.card.triggers,
      event: 'on_user_message',
      message: processedInput,
      isUserMessage: true,
      scene: triggerScene,
    });
    triggerScene = userTrigResult.scene;

    const onMsgUserResult = await executeTriggers({
      triggers: options.card.triggers,
      event: 'on_message',
      message: processedInput,
      isUserMessage: true,
      scene: triggerScene,
    });
    triggerScene = onMsgUserResult.scene;

    this.events.emit('on_user_message', { message: processedInput });

    const allMessages = [...options.messages, userMessage];

    const mergedLorebook = options.worldCard
      ? [...options.card.lorebook, ...buildWorldCharacterLore(options.worldCard)]
      : options.card.lorebook;
    const loreMatches = matchLorebook(
      allMessages,
      mergedLorebook,
      options.card.loreSettings,
    );

    let ctx: ChatContext = {
      messages: allMessages,
      card: options.card,
      scene: triggerScene,
      config: options.config,
      lorebookMatches: loreMatches,
    };

    const pipelineSteps = this.pipeline.getSteps();
    startPipeline(pipelineSteps);

    const pipelineResult = await this.pipeline.runBeforeGeneration(
      {
        sessionId: makeSessionId(options.sessionId || options.characterId || ''),
        cardId: makeCharacterId(options.characterId || ''),
        cardType: options.worldCard ? 'world' : 'character',
        messages: allMessages,
        scene: triggerScene,
        turnNumber: allMessages.filter(m => m.role === 'user').length,
        config: options.config,
      },
      (step, status) => updateStep(step, status),
    );

    if (pipelineResult.injection) {
      ctx.additionalPrompt = (ctx.additionalPrompt || '') + '\n\n' + pipelineResult.injection;
    }

    let assembled: Message[];
    let prefillText: string | null = null;

    if (options.preset) {
      const result = assembleWithPreset(options.preset, {
        card: ctx.card,
        scene: ctx.scene,
        messages: ctx.messages,
        lorebookMatches: ctx.lorebookMatches,
        persona: options.persona,
        worldCard: options.worldCard,
        additionalPrompt: ctx.additionalPrompt,
        outputLanguage: get(settingsStore).outputLanguage || '',
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

    let resolveComplete!: (msg: Message) => void;
    const onComplete = new Promise<Message>((resolve) => {
      resolveComplete = resolve;
    });

    const self = this;
    const capturedCtx = ctx;
    const capturedConfig = options.config;
    const capturedCharacterId = options.characterId;
    const capturedSessionId = options.sessionId;
    const capturedCardType = options.worldCard ? 'world' : 'character';

    async function* tokenStream(): AsyncGenerator<string> {
      const provider = self.registry.getProvider(capturedConfig.providerId);
      let fullResponse = '';
      const metadata: ChatMetadata = {};
      let providerError: unknown = null;

      updateStep('generation', 'running');
      try {
        for await (const token of provider.chat(assembled, capturedConfig, metadata)) {
          if (self.aborted) break;
          fullResponse += token;
          yield token;
        }
      } catch (err) {
        providerError = err;
      }

      let processed = applyRegexScripts(
        fullResponse,
        capturedCtx.card.regexScripts,
        'modify_output',
      );

      try {
        await self.pipeline.runAfterGeneration({
          sessionId: makeSessionId(capturedSessionId || capturedCharacterId || ''),
          cardId: makeCharacterId(capturedCharacterId || ''),
          cardType: capturedCardType,
          messages: capturedCtx.messages,
          scene: capturedCtx.scene,
          turnNumber: capturedCtx.messages.filter(m => m.role === 'user').length,
          config: capturedConfig,
        }, processed, (step, status) => updateStep(step, status));
      } catch {
      }

      if (capturedCtx.card.triggers?.length > 0) {
        try {
          const executor = new TriggerExecutor(capturedCtx.card.triggers, capturedCtx.scene.variables);
          await executor.execute('on_ai_message');
        } catch {
        }
      }
      const aiTrigResult = await executeTriggers({
        triggers: capturedCtx.card.triggers,
        event: 'on_ai_message',
        message: processed,
        isUserMessage: false,
        scene: capturedCtx.scene,
      });

      const onMsgAiResult = await executeTriggers({
        triggers: capturedCtx.card.triggers,
        event: 'on_message',
        message: processed,
        isUserMessage: false,
        scene: aiTrigResult.scene,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: processed,
        type: 'dialogue',
        characterId: capturedCharacterId,
        timestamp: Date.now(),
        generationInfo: {
          model: capturedConfig.model,
          inputTokens: metadata.inputTokens,
          outputTokens: metadata.outputTokens,
        },
      };

      resolveComplete(assistantMessage);
      updateStep('generation', 'done');
      setTimeout(resetPipeline, 300);

      if (providerError) {
        throw providerError;
      }
    }

    return {
      userMessage,
      stream: tokenStream(),
      abort: () => {
        self.aborted = true;
        resetPipeline();
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
