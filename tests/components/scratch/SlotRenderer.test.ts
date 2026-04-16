import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SlotRenderer from '$lib/components/scratch/SlotRenderer.svelte';
import type { SlotDefinition, ScratchBlock } from '$lib/types/scratch-blocks';

describe('SlotRenderer', () => {
  it('renders text slot with rounded shape', () => {
    const slot: SlotDefinition = { name: 'input', type: 'text', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const slotEl = container.querySelector('.slot');
    
    expect(slotEl).toBeTruthy();
    expect(slotEl?.classList.contains('text-slot')).toBe(true);
  });

  it('renders boolean slot with pointed shape', () => {
    const slot: SlotDefinition = { name: 'condition', type: 'boolean', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const slotEl = container.querySelector('.slot');
    
    expect(slotEl?.classList.contains('boolean-slot')).toBe(true);
  });

  it('renders chain slot for If then/else', () => {
    const slot: SlotDefinition = { name: 'then', type: 'chain', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const slotEl = container.querySelector('.slot');
    
    expect(slotEl?.classList.contains('chain-slot')).toBe(true);
  });

  it('shows placeholder text when empty', () => {
    const slot: SlotDefinition = { name: 'condition', type: 'boolean', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const placeholder = container.querySelector('.placeholder');
    expect(placeholder?.textContent).toBe('condition');
  });

  it('renders nested block when provided', () => {
    const slot: SlotDefinition = { name: 'input', type: 'text', acceptsMultiple: false };
    const block: ScratchBlock = {
      id: 'nested',
      type: 'TextBlock',
      config: { content: 'Nested content' },
      slots: {},
      next: null,
    };
    
    const { getByText } = render(SlotRenderer, { props: { slotDef: slot, block } });
    expect(getByText('Nested content')).toBeTruthy();
  });
});
