/**
 * Configuration types for AI providers and app settings.
 * Spec reference: Section 3 — Plugin System
 */

export type ConfigFieldType = 'text' | 'password' | 'number' | 'select' | 'boolean';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface UserConfig {
  providerId: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}
