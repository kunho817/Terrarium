/**
 * Script bridge — wraps Tauri invoke for Lua script execution.
 * Calls the Rust-side execute_lua_script Tauri command.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ScriptContext, ScriptResult } from './api';

export async function executeScript(
  script: string,
  context: ScriptContext,
): Promise<ScriptResult> {
  return invoke<ScriptResult>('execute_lua_script', {
    script,
    contextJson: JSON.stringify(context),
  });
}
