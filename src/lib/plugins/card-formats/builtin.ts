/**
 * Registers all built-in card format plugins with a PluginRegistry.
 */

import type { PluginRegistry } from '$lib/plugins/registry';
import { genericJsonFormat } from './generic-json';
import { risuaiFormat } from './risuai';
import { sillytavernFormat } from './sillytavern';

export function registerBuiltinCardFormats(registry: PluginRegistry): void {
  registry.registerCardFormat(risuaiFormat);
  registry.registerCardFormat(sillytavernFormat);
  registry.registerCardFormat(genericJsonFormat);
}
