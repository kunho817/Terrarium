/**
 * Block registry - manages block definitions
 */

import type { BlockDefinition, BlockType } from '$lib/types';

export class BlockRegistry {
  private definitions = new Map<BlockType, BlockDefinition>();

  register(definition: BlockDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Block type ${definition.type} already registered`);
    }
    this.definitions.set(definition.type, definition);
  }

  get(type: BlockType): BlockDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.definitions.values());
  }

  getAllByCategory(category: BlockDefinition['category']): BlockDefinition[] {
    return this.getAll().filter((d) => d.category === category);
  }

  has(type: BlockType): boolean {
    return this.definitions.has(type);
  }
}

// Global registry instance
export const blockRegistry = new BlockRegistry();

// Re-export for convenience
export { registerAllBlocks } from './definitions';
