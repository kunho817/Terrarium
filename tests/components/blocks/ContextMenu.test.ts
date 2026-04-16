import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/svelte';
import ContextMenu from '$lib/components/blocks/ContextMenu.svelte';

describe('ContextMenu', () => {
  it('renders canvas menu items', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    
    const { getByText } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'canvas', onAction, onClose }
    });
    
    expect(getByText('Add Block...')).toBeTruthy();
    expect(getByText('Clear Canvas')).toBeTruthy();
  });

  it('renders node menu items', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    
    const { getByText } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'node', blockId: 'test', onAction, onClose }
    });
    
    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('Duplicate')).toBeTruthy();
    expect(getByText('Collapse')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  it('renders port menu items', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    
    const { getByText } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'port', blockId: 'test', portId: 'output', onAction, onClose }
    });
    
    expect(getByText('Disconnect All')).toBeTruthy();
  });

  it('positions menu at specified coordinates', () => {
    const { container } = render(ContextMenu, {
      props: { x: 200, y: 150, type: 'canvas', onAction: vi.fn(), onClose: vi.fn() }
    });
    
    const menu = container.querySelector('.context-menu');
    expect(menu).toBeTruthy();
    expect(menu?.getAttribute('style')).toContain('left: 200px');
    expect(menu?.getAttribute('style')).toContain('top: 150px');
  });

  it('calls onAction when menu item clicked', async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    
    const { container } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'canvas', onAction, onClose }
    });
    
    const menu = container.querySelector('.context-menu');
    const item = within(menu as HTMLElement).getByText('Clear Canvas');
    item.click();
    
    expect(onAction).toHaveBeenCalledWith('clear-canvas', {});
  });

  it('calls onClose after action', async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    
    const { container } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'canvas', onAction, onClose }
    });
    
    const menu = container.querySelector('.context-menu');
    const item = within(menu as HTMLElement).getByText('Clear Canvas');
    item.click();
    
    expect(onClose).toHaveBeenCalled();
  });
});
