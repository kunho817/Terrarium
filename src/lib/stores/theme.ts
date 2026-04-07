/**
 * Theme store — tracks current theme name.
 */

import { derived } from 'svelte/store';
import { settingsStore } from './settings';

export const currentTheme = derived(settingsStore, ($settings) => $settings.theme);
