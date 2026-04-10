import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatEngine, consumeStream } from '$lib/core/chat/engine';
import type { SendMessageOptions } from '$lib/core/chat/engine';
import { PluginRegistry } from '$lib/plugins/registry';
import { registerBuiltinPromptBuilders } from '$lib/plugins/prompt-builder/builtin';
import type { ProviderPlugin, Message, UserConfig, CharacterCard, SceneState } from '$lib/types';

// Mock script bridge
const mockExecuteScript = vi.fn();
vi.mock('$lib/core/scripting/bridge', () => ({
  executeScript: (...args: unknown[]) => mockExecuteScript(...args),
}));

// === Mock provider ===

function createMockProvider(tokens: string[] = ['Hello', ' world', '!']): ProviderPlugin {
  const provider: ProviderPlugin = {
    id: 'mock',
    name: 'Mock Provider',
    requiredConfig: [],
    validateConfig: async () => true,

    async *chat(messages: Message[], _config: UserConfig): AsyncGenerator<string> {
      for (const token of tokens) {
        yield token;
      }
    },

    async *chatWithCard(messages: Message[], _card: CharacterCard, _config: UserConfig): AsyncGenerator<string> {
      yield* provider.chat(messages, _config);
    },
  };

  return provider;
}

// === Test fixtures ===

const baseCard: CharacterCard = {
  name: 'Alice',
  description: 'A friendly elf',
  personality: 'Cheerful',
  scenario: 'Forest village',
  firstMessage: 'Hi!',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: 'You are Alice, a friendly elf.',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

const baseScene: SceneState = {
  location: '',
  time: '',
  mood: '',
  participatingCharacters: [],
  variables: {},
};

const baseConfig: UserConfig = {
  providerId: 'mock',
  model: 'test-model',
};

function createEngine(provider?: ProviderPlugin): { engine: ChatEngine; registry: PluginRegistry } {
  const registry = new PluginRegistry();
  registry.registerProvider(provider || createMockProvider());
  registerBuiltinPromptBuilders(registry);
  const engine = new ChatEngine(registry);
  return { engine, registry };
}

describe('ChatEngine', () => {
  describe('send', () => {
    it('returns user message with processed content', async () => {
      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Hello Alice',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });

      expect(result.userMessage.role).toBe('user');
      expect(result.userMessage.content).toBe('Hello Alice');
      expect(result.userMessage.type).toBe('dialogue');
    });

    it('streams tokens from provider', async () => {
      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });

      const { tokens, message } = await consumeStream(result);
      expect(tokens).toEqual(['Hello', ' world', '!']);
      expect(message.content).toBe('Hello world!');
    });

    it('returns assistant message with correct fields', async () => {
      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
        characterId: 'alice-123',
      });

      const { message } = await consumeStream(result);
      expect(message.role).toBe('assistant');
      expect(message.type).toBe('dialogue');
      expect(message.characterId).toBe('alice-123');
      expect(message.generationInfo?.model).toBe('test-model');
    });

    it('applies modify_input regex scripts', async () => {
      const card: CharacterCard = {
        ...baseCard,
        regexScripts: [
          {
            id: 'r1',
            name: 'Replace test',
            pattern: 'test',
            replacement: 'exam',
            stage: 'modify_input',
            enabled: true,
            flag: 'g',
          },
        ],
      };
      const { engine } = createEngine();
      const result = await engine.send({
        input: 'This is a test message',
        type: 'dialogue',
        card,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });

      expect(result.userMessage.content).toBe('This is a exam message');
    });

    it('applies modify_output regex scripts', async () => {
      const card: CharacterCard = {
        ...baseCard,
        regexScripts: [
          {
            id: 'r1',
            name: 'Replace world',
            pattern: 'world',
            replacement: 'earth',
            stage: 'modify_output',
            enabled: true,
            flag: 'g',
          },
        ],
      };
      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });

      const { message } = await consumeStream(result);
      expect(message.content).toBe('Hello earth!');
    });

    it('calls agent onBeforeSend hooks', async () => {
      const { engine, registry } = createEngine();
      let beforeSendCalled = false;

      registry.registerAgent({
        id: 'test-agent',
        name: 'Test Agent',
        async onBeforeSend(ctx) {
          beforeSendCalled = true;
          return ctx;
        },
        async onAfterReceive(_ctx, response) {
          return response;
        },
        async runBackground() {},
      });

      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });
      await consumeStream(result);

      expect(beforeSendCalled).toBe(true);
    });

    it('calls agent onAfterReceive hooks', async () => {
      const { engine, registry } = createEngine();
      let afterReceiveInput = '';

      registry.registerAgent({
        id: 'test-agent',
        name: 'Test Agent',
        async onBeforeSend(ctx) {
          return ctx;
        },
        async onAfterReceive(_ctx, response) {
          afterReceiveInput = response;
          return response.toUpperCase();
        },
        async runBackground() {},
      });

      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });

      const { message } = await consumeStream(result);
      expect(afterReceiveInput).toBe('Hello world!');
      expect(message.content).toBe('HELLO WORLD!');
    });

    it('integrates lorebook matching into pipeline', async () => {
      const card: CharacterCard = {
        ...baseCard,
        lorebook: [
          {
            id: 'lore1',
            name: 'Magic',
            keywords: ['magic'],
            caseSensitive: false,
            content: 'Magic is real in this world.',
            position: 'after_messages',
            priority: 10,
            enabled: true,
            scanDepth: 5,
            scope: 'global',
            mode: 'normal',
            constant: false,
          },
        ],
        loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
      };

      const mockProvider = createMockProvider(['Response']);
      const { engine } = createEngine(mockProvider);
      const result = await engine.send({
        input: 'Tell me about magic',
        type: 'dialogue',
        card,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });
      const { message } = await consumeStream(result);
      expect(message.content).toBe('Response');
    });

    it('supports abort mid-stream', async () => {
      const slowProvider = createMockProvider(['a', 'b', 'c', 'd', 'e']);
      const { engine } = createEngine(slowProvider);

      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });

      // Consume a few tokens then abort
      const tokens: string[] = [];
      for await (const token of result.stream) {
        tokens.push(token);
        if (tokens.length === 2) {
          result.abort();
        }
      }

      const msg = await result.onComplete;
      expect(tokens.length).toBeLessThanOrEqual(3);
      expect(msg.content).toBeTruthy();
    });

    it('uses PromptBuilderPlugin for system prompt', async () => {
      const mockProvider = createMockProvider(['ok']);
      const { engine } = createEngine(mockProvider);
      const result = await engine.send({
        input: 'Hi',
        type: 'dialogue',
        card: baseCard,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });
      const { message } = await consumeStream(result);
      expect(message.content).toBe('ok');
    });
  });

  describe('trigger integration', () => {
    // Reset mock before each test in this block
    beforeEach(() => {
      mockExecuteScript.mockReset();
    });

    it('fires on_user_message triggers before AI call', async () => {
      const cardWithTrigger: CharacterCard = {
        ...baseCard,
        triggers: [
          {
            id: 't1',
            name: 'Track damage',
            enabled: true,
            event: 'on_user_message',
            pattern: '\\[attack.*\\]',
            script: 'setVar("last_action", "attack")',
          },
        ],
      };

      mockExecuteScript.mockResolvedValue({
        success: true,
        mutations: [{ type: 'setVar', key: 'last_action', value: 'attack' }],
        logs: [],
      });

      const { engine } = createEngine();
      const result = await engine.send({
        input: '[attack] the dragon',
        type: 'dialogue',
        card: cardWithTrigger,
        scene: { ...baseScene, variables: {} },
        config: baseConfig,
        messages: [],
      });
      await consumeStream(result);

      expect(mockExecuteScript).toHaveBeenCalledTimes(1);
    });

    it('fires on_ai_message triggers after AI response', async () => {
      const cardWithTrigger: CharacterCard = {
        ...baseCard,
        triggers: [
          {
            id: 't2',
            name: 'Track AI damage',
            enabled: true,
            event: 'on_ai_message',
            script: 'setVar("ai_responded", true)',
          },
        ],
      };

      mockExecuteScript.mockResolvedValue({
        success: true,
        mutations: [{ type: 'setVar', key: 'ai_responded', value: true }],
        logs: [],
      });

      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Hello',
        type: 'dialogue',
        card: cardWithTrigger,
        scene: { ...baseScene, variables: {} },
        config: baseConfig,
        messages: [],
      });
      await consumeStream(result);

      expect(mockExecuteScript).toHaveBeenCalled();
    });

    it('does not fire disabled triggers', async () => {
      const cardWithTrigger: CharacterCard = {
        ...baseCard,
        triggers: [
          {
            id: 't3',
            name: 'Disabled trigger',
            enabled: false,
            event: 'on_user_message',
            script: 'log("should not run")',
          },
        ],
      };

      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Hello',
        type: 'dialogue',
        card: cardWithTrigger,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });
      await consumeStream(result);

      expect(mockExecuteScript).not.toHaveBeenCalled();
    });

    it('skips triggers when pattern does not match', async () => {
      const cardWithTrigger: CharacterCard = {
        ...baseCard,
        triggers: [
          {
            id: 't4',
            name: 'Attack only',
            enabled: true,
            event: 'on_user_message',
            pattern: '\\[attack.*\\]',
            script: 'setVar("attacked", true)',
          },
        ],
      };

      const { engine } = createEngine();
      const result = await engine.send({
        input: 'Just saying hello',
        type: 'dialogue',
        card: cardWithTrigger,
        scene: baseScene,
        config: baseConfig,
        messages: [],
      });
      await consumeStream(result);

      expect(mockExecuteScript).not.toHaveBeenCalled();
    });
  });
});
