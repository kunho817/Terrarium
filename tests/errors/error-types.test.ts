import { describe, it, expect } from 'vitest';
import { StorageError, ProviderError, ValidationError, NetworkError } from '$lib/errors/error-types';

describe('Error Types', () => {
  it('StorageError has correct properties', () => {
    const error = new StorageError('saveCharacter', 'Failed to save character');
    
    expect(error.category).toBe('storage');
    expect(error.severity).toBe('error');
    expect(error.userMessage).toBe('Failed to save character');
    expect(error.context.operation).toBe('saveCharacter');
    expect(error.context.userVisible).toBe(true);
  });

  it('ProviderError includes providerId', () => {
    const error = new ProviderError('openai', 'sendMessage', 'API error');
    
    expect(error.providerId).toBe('openai');
    expect(error.category).toBe('provider');
    expect(error.userMessage).toBe('API error');
  });

  it('ValidationError has lower severity', () => {
    const error = new ValidationError('name', 'empty', 'Name is required');
    
    expect(error.severity).toBe('warning');
    expect(error.field).toBe('name');
  });

  it('NetworkError has user-friendly message', () => {
    const error = new NetworkError('fetchModels', '/api/models');
    
    expect(error.category).toBe('network');
    expect(error.endpoint).toBe('/api/models');
    expect(error.userMessage).toBe('Connection failed. Please check your internet.');
  });

  it('errors can be serialized to JSON', () => {
    const original = new Error('original');
    const error = new StorageError('test', 'message', original);
    
    const json = error.toJSON();
    expect(json.name).toBe('StorageError');
    expect(json.severity).toBe('error');
    expect(json.originalError).toBe('original');
  });

  it('ValidationError uses default message if not provided', () => {
    const error = new ValidationError('email', 'invalid');
    
    expect(error.userMessage).toBe('Invalid value for email');
  });

  it('StorageError uses default message if not provided', () => {
    const error = new StorageError('loadSettings');
    
    expect(error.userMessage).toBe('Failed to save data');
  });

  it('ProviderError uses default message if not provided', () => {
    const error = new ProviderError('anthropic', 'sendMessage');
    
    expect(error.userMessage).toBe('AI provider error');
  });

  it('errors capture timestamp', () => {
    const before = Date.now();
    const error = new StorageError('test', 'message');
    const after = Date.now();
    
    expect(error.context.timestamp).toBeGreaterThanOrEqual(before);
    expect(error.context.timestamp).toBeLessThanOrEqual(after);
  });
});
