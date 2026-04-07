import { vi } from 'vitest';

export const readTextFile = vi.fn();
export const writeTextFile = vi.fn();
export const readDir = vi.fn();
export const createDir = vi.fn();
export const exists = vi.fn();
export const remove = vi.fn();
export const rename = vi.fn();
export const copyFile = vi.fn();

export const BaseDirectory = {
  AppData: 1,
};
