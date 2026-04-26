function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry)) as T;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const cloned: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      cloned[key] = cloneValue(entry);
    }
    return cloned as T;
  }

  return value;
}

export function cloneSerializable<T>(value: T): T {
  return cloneValue(value);
}
