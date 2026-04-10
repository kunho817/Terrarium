import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { executeScript } from '$lib/core/scripting/bridge';
import type { ScriptContext } from '$lib/core/scripting/api';

describe('executeScript', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('calls Tauri invoke with correct parameters', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      mutations: [],
      logs: [],
    });

    const context: ScriptContext = {
      variables: { hp: 100 },
      scene: { location: 'forest', time: 'day', mood: 'calm' },
    };

    await executeScript('setVar("hp", 50)', context);

    expect(mockInvoke).toHaveBeenCalledWith('execute_lua_script', {
      script: 'setVar("hp", 50)',
      contextJson: JSON.stringify(context),
    });
  });

  it('returns ScriptResult from Lua runtime', async () => {
    const expectedResult = {
      success: true,
      mutations: [{ type: 'setVar', key: 'hp', value: 50 }],
      logs: ['HP updated'],
    };
    mockInvoke.mockResolvedValue(expectedResult);

    const result = await executeScript('setVar("hp", 50)', {
      variables: {},
      scene: { location: '', time: '', mood: '' },
    });

    expect(result).toEqual(expectedResult);
  });

  it('handles Lua runtime errors', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: 'Syntax error at line 1',
      mutations: [],
      logs: [],
    });

    const result = await executeScript('invalid{[', {
      variables: {},
      scene: { location: '', time: '', mood: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Syntax error at line 1');
  });

  it('handles Tauri invoke failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri not available'));

    await expect(executeScript('setVar("x", 1)', {
      variables: {},
      scene: { location: '', time: '', mood: '' },
    })).rejects.toThrow('Tauri not available');
  });
});
