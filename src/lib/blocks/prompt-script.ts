import type {
  AgentPromptGraphKey,
  AgentPromptOverrideSettings,
  AgentPromptPrefillSettings,
  GraphPromptTemplate,
  ImagePromptGraphKey,
  PromptItem,
  PromptItemRole,
  PromptItemType,
  PromptPreset,
  PromptScript,
  PromptScriptBlock,
  PromptScriptComposeMode,
  PromptScriptStage,
  PromptScriptTarget,
  PromptScriptTargetKey,
} from '$lib/types';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
import {
  createDefaultAgentPrefills,
  createDefaultAgentPromptOverrides,
} from '$lib/core/agents/prompt-defaults';
import { presetToBlocks } from './preset-migration';
import { createTextGraphTemplate } from './template-runtime';
import { cloneSerializable } from '$lib/utils/clone-serializable';

type AgentSettingKey = AgentPromptGraphKey;
type ImageSettingKey = ImagePromptGraphKey;

interface AgentTargetMeta {
  key: PromptScriptTargetKey;
  settingKey: AgentSettingKey;
  label: string;
  role: PromptItemRole;
}

interface ImageTargetMeta {
  key: PromptScriptTargetKey;
  settingKey: ImageSettingKey;
  label: string;
  role: PromptItemRole;
}

export interface CompiledPromptScriptTarget {
  key: PromptScriptTargetKey;
  label: string;
  role: PromptItemRole;
  composeMode: PromptScriptComposeMode;
  compiledText: string;
  items?: PromptItem[];
  template: GraphPromptTemplate;
}

export const PROMPT_SCRIPT_STAGES: Array<Pick<PromptScriptStage, 'key' | 'label' | 'description'>> = [
  {
    key: 'stage.context',
    label: 'Context',
    description: 'Card, persona, world, and scene-wide reinforcement.',
  },
  {
    key: 'stage.memory',
    label: 'Memory',
    description: 'Memory retrieval and continuity reinforcement.',
  },
  {
    key: 'stage.planning',
    label: 'Planning',
    description: 'Story Author, Director, combined planning, and agent guardrails.',
  },
  {
    key: 'stage.generation',
    label: 'Generation',
    description: 'Main chat prompt sequence and assistant prefill.',
  },
  {
    key: 'stage.extraction',
    label: 'Extraction',
    description: 'Post-generation extraction and repair prompts.',
  },
  {
    key: 'stage.memoryUpdate',
    label: 'Memory Update',
    description: 'Section-world and long-range summary prompts.',
  },
  {
    key: 'stage.illustration',
    label: 'Illustration',
    description: 'Image planning, image prompt generation, backfill, and image guardrails.',
  },
];

export const AGENT_SCRIPT_TARGETS: AgentTargetMeta[] = [
  { key: 'agent.storyAuthorSystem', settingKey: 'storyAuthorSystem', label: 'Story Author', role: 'system' },
  { key: 'agent.directorSystem', settingKey: 'directorSystem', label: 'Director', role: 'system' },
  { key: 'agent.turnMaintenanceSystem', settingKey: 'turnMaintenanceSystem', label: 'Combined Planning', role: 'system' },
  { key: 'agent.storyAuthor', settingKey: 'storyAuthor', label: 'Story Author Prefill', role: 'assistant' },
  { key: 'agent.director', settingKey: 'director', label: 'Director Prefill', role: 'assistant' },
  { key: 'agent.turnMaintenance', settingKey: 'turnMaintenance', label: 'Planning Prefill', role: 'assistant' },
  { key: 'agent.jailbreak', settingKey: 'jailbreak', label: 'Agent Jailbreak', role: 'system' },
  { key: 'agent.extractionSystem', settingKey: 'extractionSystem', label: 'Extraction', role: 'system' },
  { key: 'agent.extractionWorldSystem', settingKey: 'extractionWorldSystem', label: 'Extraction (World)', role: 'system' },
  { key: 'agent.extractionFallbackSystem', settingKey: 'extractionFallbackSystem', label: 'Extraction Fallback', role: 'system' },
  { key: 'agent.extractionRepairSystem', settingKey: 'extractionRepairSystem', label: 'Extraction Repair', role: 'system' },
  { key: 'agent.extraction', settingKey: 'extraction', label: 'Extraction Prefill', role: 'assistant' },
  { key: 'agent.extractionFallback', settingKey: 'extractionFallback', label: 'Extraction Fallback Prefill', role: 'assistant' },
  { key: 'agent.extractionRepair', settingKey: 'extractionRepair', label: 'Extraction Repair Prefill', role: 'assistant' },
  { key: 'agent.sectionWorldSystem', settingKey: 'sectionWorldSystem', label: 'Section World', role: 'system' },
  { key: 'agent.summarySystem', settingKey: 'summarySystem', label: 'Summary', role: 'system' },
  { key: 'agent.sectionWorld', settingKey: 'sectionWorld', label: 'Section World Prefill', role: 'assistant' },
  { key: 'agent.summary', settingKey: 'summary', label: 'Summary Prefill', role: 'assistant' },
];

export const IMAGE_SCRIPT_TARGETS: ImageTargetMeta[] = [
  { key: 'image.planningSystemPrompt', settingKey: 'planningSystemPrompt', label: 'Image Planning', role: 'system' },
  { key: 'image.planningPrefill', settingKey: 'planningPrefill', label: 'Image Planning Prefill', role: 'assistant' },
  { key: 'image.imagePromptInstructions', settingKey: 'imagePromptInstructions', label: 'Image Prompt', role: 'system' },
  { key: 'image.promptPrefill', settingKey: 'promptPrefill', label: 'Image Prompt Prefill', role: 'assistant' },
  { key: 'image.backfillSystemPrompt', settingKey: 'backfillSystemPrompt', label: 'Image Backfill', role: 'system' },
  { key: 'image.backfillPrefill', settingKey: 'backfillPrefill', label: 'Image Backfill Prefill', role: 'assistant' },
  { key: 'image.jailbreak', settingKey: 'jailbreak', label: 'Image Jailbreak', role: 'system' },
];

const AGENT_SYSTEM_KEYS = new Set<keyof AgentPromptOverrideSettings>([
  'storyAuthorSystem',
  'directorSystem',
  'turnMaintenanceSystem',
  'extractionSystem',
  'extractionWorldSystem',
  'extractionFallbackSystem',
  'extractionRepairSystem',
  'sectionWorldSystem',
  'summarySystem',
]);

const AGENT_PREFILL_KEYS = new Set<keyof AgentPromptPrefillSettings>([
  'storyAuthor',
  'director',
  'turnMaintenance',
  'extraction',
  'extractionFallback',
  'extractionRepair',
  'sectionWorld',
  'summary',
]);

function uid(): string {
  return crypto.randomUUID();
}

function textBlock(label: string, content: string, role: PromptItemRole = 'system'): PromptScriptBlock {
  return {
    id: uid(),
    type: 'text',
    label,
    role,
    enabled: true,
    collapsed: false,
    content,
  };
}

function promptItemBlock(item: PromptItem): PromptScriptBlock {
  return {
    id: uid(),
    type: 'promptItem',
    collapsed: false,
    item: cloneSerializable(item),
  };
}

function target(
  key: PromptScriptTargetKey,
  label: string,
  role: PromptItemRole,
  composeMode: PromptScriptComposeMode,
  blocks: PromptScriptBlock[],
): PromptScriptTarget {
  return {
    id: uid(),
    key,
    label,
    role,
    composeMode,
    collapsed: false,
    blocks,
  };
}

function stage(
  key: string,
  targets: PromptScriptTarget[],
): PromptScriptStage {
  const meta = PROMPT_SCRIPT_STAGES.find((entry) => entry.key === key);
  return {
    id: uid(),
    key,
    label: meta?.label ?? key,
    description: meta?.description ?? '',
    collapsed: false,
    targets,
  };
}

function getAgentContent(preset: PromptPreset, settingKey: AgentSettingKey): string {
  if (settingKey === 'jailbreak') {
    return preset.agentJailbreak ?? '';
  }
  if (AGENT_SYSTEM_KEYS.has(settingKey as keyof AgentPromptOverrideSettings)) {
    const defaults = createDefaultAgentPromptOverrides();
    return preset.agentPromptOverrides?.[settingKey] ?? defaults[settingKey as keyof AgentPromptOverrideSettings] ?? '';
  }
  if (AGENT_PREFILL_KEYS.has(settingKey as keyof AgentPromptPrefillSettings)) {
    const defaults = createDefaultAgentPrefills();
    return preset.agentPrefills?.[settingKey] ?? defaults[settingKey as keyof AgentPromptPrefillSettings] ?? '';
  }
  return '';
}

function getImageContent(preset: PromptPreset, settingKey: ImageSettingKey): string {
  if (settingKey === 'jailbreak') {
    return preset.imageJailbreak ?? DEFAULT_IMAGE_CONFIG.jailbreak ?? '';
  }
  return preset.imagePrompts?.[settingKey] ?? String(DEFAULT_IMAGE_CONFIG[settingKey] ?? '');
}

function stageTargetsForAgent(
  preset: PromptPreset,
  settingKeys: AgentSettingKey[],
): PromptScriptTarget[] {
  return AGENT_SCRIPT_TARGETS
    .filter((meta) => settingKeys.includes(meta.settingKey))
    .map((meta) =>
      target(
        meta.key,
        meta.label,
        meta.role,
        'replace',
        [textBlock(meta.label, getAgentContent(preset, meta.settingKey), meta.role)],
      ),
    );
}

function stageTargetsForImage(preset: PromptPreset): PromptScriptTarget[] {
  return IMAGE_SCRIPT_TARGETS.map((meta) =>
    target(
      meta.key,
      meta.label,
      meta.role,
      'replace',
      [textBlock(meta.label, getImageContent(preset, meta.settingKey), meta.role)],
    ),
  );
}

export function createPromptScriptFromPreset(preset: PromptPreset): PromptScript {
  if (preset.promptScript?.version === '1.0') {
    return cloneSerializable(preset.promptScript);
  }

  return {
    version: '1.0',
    stages: [
      stage('stage.context', [
        target('main.prompt', 'Context Reinforcement', 'system', 'augment', [
          textBlock('Context Note', ''),
        ]),
      ]),
      stage('stage.memory', [
        target('main.prompt', 'Memory Reinforcement', 'system', 'augment', [
          textBlock('Memory Note', ''),
        ]),
      ]),
      stage('stage.planning', stageTargetsForAgent(preset, [
        'storyAuthorSystem',
        'directorSystem',
        'turnMaintenanceSystem',
        'storyAuthor',
        'director',
        'turnMaintenance',
        'jailbreak',
      ])),
      stage('stage.generation', [
        target(
          'main.prompt',
          'Main Prompt',
          'system',
          'replace',
          preset.items.map((item) => promptItemBlock(item)),
        ),
        target('main.prefill', 'Main Prefill', 'assistant', 'replace', [
          textBlock('Main Prefill', preset.assistantPrefill ?? '', 'assistant'),
        ]),
      ]),
      stage('stage.extraction', stageTargetsForAgent(preset, [
        'extractionSystem',
        'extractionWorldSystem',
        'extractionFallbackSystem',
        'extractionRepairSystem',
        'extraction',
        'extractionFallback',
        'extractionRepair',
      ])),
      stage('stage.memoryUpdate', stageTargetsForAgent(preset, [
        'sectionWorldSystem',
        'summarySystem',
        'sectionWorld',
        'summary',
      ])),
      stage('stage.illustration', stageTargetsForImage(preset)),
    ],
  };
}

function compileBlocksText(blocks: PromptScriptBlock[], separator = '\n\n'): string {
  return blocks
    .map((block) => compileBlockText(block))
    .filter((value) => value.trim().length > 0)
    .join(separator);
}

function compileBlockText(block: PromptScriptBlock): string {
  switch (block.type) {
    case 'text':
      return block.enabled ? block.content : '';
    case 'promptItem':
      return block.item.enabled ? block.item.content : '';
    case 'merge':
      return block.enabled ? compileBlocksText(block.blocks, block.separator || '\n\n') : '';
    case 'if':
      if (!block.enabled) {
        return '';
      }
      return compileBlocksText(block.conditionEnabled ? block.thenBlocks : block.elseBlocks);
    default:
      return '';
  }
}

function flattenPromptItems(blocks: PromptScriptBlock[]): PromptItem[] {
  const items: PromptItem[] = [];

  for (const block of blocks) {
    if (block.type === 'promptItem') {
      items.push(cloneSerializable(block.item));
      continue;
    }

    if (block.type === 'if') {
      if (!block.enabled) {
        continue;
      }
      items.push(...flattenPromptItems(block.conditionEnabled ? block.thenBlocks : block.elseBlocks));
      continue;
    }

    if (block.type === 'merge') {
      const content = compileBlockText(block).trim();
      if (content) {
        items.push(makePlainPromptItem(block.label || 'Merged Prompt', content));
      }
      continue;
    }

    const content = compileBlockText(block).trim();
    if (content) {
      items.push(makePlainPromptItem(block.label || 'Text', content, block.role));
    }
  }

  return items;
}

function makePlainPromptItem(
  name: string,
  content: string,
  role: PromptItemRole = 'system',
  type: PromptItemType = 'plain',
): PromptItem {
  return {
    id: uid(),
    type,
    name,
    enabled: true,
    role,
    content,
  };
}

export function compilePromptScript(script: PromptScript): CompiledPromptScriptTarget[] {
  const outputs: CompiledPromptScriptTarget[] = [];

  for (const scriptStage of script.stages) {
    for (const scriptTarget of scriptStage.targets) {
      const compiledText = compileBlocksText(scriptTarget.blocks);
      const items = scriptTarget.key === 'main.prompt' && scriptTarget.composeMode === 'replace'
        ? flattenPromptItems(scriptTarget.blocks)
        : undefined;
      outputs.push({
        key: scriptTarget.key,
        label: scriptTarget.label,
        role: scriptTarget.role,
        composeMode: scriptTarget.composeMode,
        compiledText,
        items,
        template: createTextGraphTemplate(compiledText, scriptTarget.label, scriptTarget.role),
      });
    }
  }

  return outputs;
}

function appendPrompt(base: string, patch: string, mode: PromptScriptComposeMode): string {
  const normalizedBase = base.trim();
  const normalizedPatch = patch.trim();
  if (!normalizedPatch) {
    return normalizedBase;
  }
  return mode === 'augment' && normalizedBase
    ? `${normalizedBase}\n\n${normalizedPatch}`
    : normalizedPatch;
}

function insertMainPromptAugments(
  items: PromptItem[],
  augments: Array<{ label: string; text: string }>,
): PromptItem[] {
  const augmentItems = augments
    .map((augment) => augment.text.trim()
      ? makePlainPromptItem(augment.label, augment.text.trim())
      : null)
    .filter((item): item is PromptItem => item !== null);

  if (augmentItems.length === 0) {
    return items;
  }

  const insertIndex = items.findIndex((item) => item.type === 'chatHistory');
  if (insertIndex === -1) {
    return [...items, ...augmentItems];
  }

  return [
    ...items.slice(0, insertIndex),
    ...augmentItems,
    ...items.slice(insertIndex),
  ];
}

export function applyPromptScriptToPreset(
  preset: PromptPreset,
  script: PromptScript,
): PromptPreset {
  const outputs = compilePromptScript(script);
  let nextPreset: PromptPreset = cloneSerializable(preset);
  const nextAgentOverrides = {
    ...createDefaultAgentPromptOverrides(),
    ...(nextPreset.agentPromptOverrides ?? {}),
  } as AgentPromptOverrideSettings;
  const nextAgentPrefills = {
    ...createDefaultAgentPrefills(),
    ...(nextPreset.agentPrefills ?? {}),
  } as AgentPromptPrefillSettings;
  const nextImagePrompts = {
    planningSystemPrompt: nextPreset.imagePrompts?.planningSystemPrompt ?? DEFAULT_IMAGE_CONFIG.planningSystemPrompt ?? '',
    planningPrefill: nextPreset.imagePrompts?.planningPrefill ?? DEFAULT_IMAGE_CONFIG.planningPrefill ?? '',
    imagePromptInstructions: nextPreset.imagePrompts?.imagePromptInstructions ?? DEFAULT_IMAGE_CONFIG.imagePromptInstructions ?? '',
    promptPrefill: nextPreset.imagePrompts?.promptPrefill ?? DEFAULT_IMAGE_CONFIG.promptPrefill ?? '',
    backfillSystemPrompt: nextPreset.imagePrompts?.backfillSystemPrompt ?? DEFAULT_IMAGE_CONFIG.backfillSystemPrompt ?? '',
    backfillPrefill: nextPreset.imagePrompts?.backfillPrefill ?? DEFAULT_IMAGE_CONFIG.backfillPrefill ?? '',
  };
  let nextAgentJailbreak = nextPreset.agentJailbreak ?? '';
  let nextImageJailbreak = nextPreset.imageJailbreak ?? DEFAULT_IMAGE_CONFIG.jailbreak ?? '';
  const mainPromptAugments: Array<{ label: string; text: string }> = [];

  for (const output of outputs) {
    if (output.key === 'main.prompt') {
      if (output.composeMode === 'augment') {
        mainPromptAugments.push({ label: output.label, text: output.compiledText });
        continue;
      }
      nextPreset = {
        ...nextPreset,
        items: output.items ?? [makePlainPromptItem(output.label, output.compiledText)],
      };
      continue;
    }

    if (output.key === 'main.prefill') {
      nextPreset.assistantPrefill = output.compiledText;
      continue;
    }

    const agentTarget = AGENT_SCRIPT_TARGETS.find((entry) => entry.key === output.key);
    if (agentTarget) {
      if (agentTarget.settingKey === 'jailbreak') {
        nextAgentJailbreak = appendPrompt(nextAgentJailbreak, output.compiledText, output.composeMode);
      } else if (AGENT_SYSTEM_KEYS.has(agentTarget.settingKey as keyof AgentPromptOverrideSettings)) {
        const key = agentTarget.settingKey as keyof AgentPromptOverrideSettings;
        nextAgentOverrides[key] = appendPrompt(nextAgentOverrides[key], output.compiledText, output.composeMode);
      } else {
        const key = agentTarget.settingKey as keyof AgentPromptPrefillSettings;
        nextAgentPrefills[key] = appendPrompt(nextAgentPrefills[key], output.compiledText, output.composeMode);
      }
      continue;
    }

    const imageTarget = IMAGE_SCRIPT_TARGETS.find((entry) => entry.key === output.key);
    if (imageTarget) {
      if (imageTarget.settingKey === 'jailbreak') {
        nextImageJailbreak = appendPrompt(nextImageJailbreak, output.compiledText, output.composeMode);
      } else {
        const key = imageTarget.settingKey as keyof typeof nextImagePrompts;
        nextImagePrompts[key] = appendPrompt(nextImagePrompts[key], output.compiledText, output.composeMode);
      }
    }
  }

  nextPreset.items = insertMainPromptAugments(nextPreset.items, mainPromptAugments);
  nextPreset.blockGraph = presetToBlocks(nextPreset);
  nextPreset.blockToggles = [];
  nextPreset.promptScript = cloneSerializable(script);
  nextPreset.agentPromptOverrides = { ...nextAgentOverrides };
  nextPreset.agentPrefills = { ...nextAgentPrefills };
  nextPreset.agentPromptGraphs = {};
  nextPreset.agentJailbreak = nextAgentJailbreak;
  nextPreset.imagePrompts = nextImagePrompts;
  nextPreset.imagePromptGraphs = {};
  nextPreset.imageJailbreak = nextImageJailbreak;

  return nextPreset;
}
