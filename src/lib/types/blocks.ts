/**
 * Block-based prompt builder types
 */

export type BlockType = 
  | 'TextBlock' 
  | 'FieldBlock' 
  | 'MemoryBlock' 
  | 'LorebookBlock'
  | 'IfBlock' 
  | 'ToggleBlock' 
  | 'SwitchBlock' 
  | 'MergeBlock'
  | 'VariableBlock' 
  | 'LoopBlock';

export type PortType = 'text' | 'boolean' | 'number' | 'list';

export interface Port {
  id: string;
  name: string;
  type: PortType;
  required: boolean;
}

export interface InputPort extends Port {
  direction: 'input';
}

export interface OutputPort extends Port {
  direction: 'output';
}

export interface BlockConfig {
  [key: string]: unknown;
}

export interface BlockDefinition {
  type: BlockType;
  category: 'foundation' | 'logic' | 'data' | 'structure';
  displayName: string;
  icon: string;
  description: string;
  color: string;
  inputPorts: InputPort[];
  outputPorts: OutputPort[];
  defaultConfig: BlockConfig;
}

export interface BlockInstance {
  id: string;
  type: BlockType;
  position: { x: number; y: number };
  config: BlockConfig;
  collapsed?: boolean;
}

export interface Connection {
  id: string;
  from: { blockId: string; portId: string };
  to: { blockId: string; portId: string };
}

export interface BlockGraph {
  version: '1.0';
  blocks: BlockInstance[];
  connections: Connection[];
}
