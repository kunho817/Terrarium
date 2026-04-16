export type BlockType =
  | 'TextBlock'
  | 'FieldBlock'
  | 'MemoryBlock'
  | 'LorebookBlock'
  | 'IfBlock'
  | 'ToggleBlock'
  | 'SwitchBlock'
  | 'MergeBlock';

export type SlotType = 'text' | 'boolean' | 'number' | 'list' | 'chain';

export interface BlockConfig {
  [key: string]: unknown;
}

export interface ScratchBlock {
  id: string;
  type: BlockType;
  config: BlockConfig;
  slots: Record<string, ScratchBlock | null>;
  next: ScratchBlock | null;
}

export interface ScratchScript {
  id: string;
  name: string;
  root: ScratchBlock;
}

export interface SlotDefinition {
  name: string;
  type: SlotType;
  acceptsMultiple: boolean;
}

export interface BlockDefinition {
  type: BlockType;
  category: 'foundation' | 'logic' | 'data' | 'structure';
  displayName: string;
  icon: string;
  color: string;
  slots: SlotDefinition[];
  outputType: SlotType;
  defaultConfig: BlockConfig;
}

export function createBlock(type: BlockType, id: string): ScratchBlock {
  return {
    id,
    type,
    config: {},
    slots: {},
    next: null,
  };
}

export function createScript(name: string): ScratchScript {
  return {
    id: crypto.randomUUID(),
    name,
    root: createBlock('TextBlock', crypto.randomUUID()),
  };
}
