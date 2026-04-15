# Code Style and Conventions

## TypeScript Style
- **Strict mode enabled**: All code must pass strict type checking
- **Module type**: ES modules (`"type": "module"` in package.json)
- **File extension**: `.ts` for TypeScript, `.svelte` for Svelte components

## Naming Conventions
- **Stores**: `*Store` suffix (e.g., `charactersStore`, `chatStore`)
- **Types**: PascalCase (e.g., `CharacterCard`, `WorldCard`)
- **Interfaces**: PascalCase, descriptive names
- **Functions**: camelCase, descriptive verbs
- **Constants**: camelCase for local, UPPER_SNAKE_CASE for true constants

## Svelte Conventions
- **Runes**: Use Svelte 5 runes ($state, $derived, $effect)
- **Store subscription**: Use `$store` shorthand in components
- **Component props**: Use TypeScript interfaces for prop types

## Store Pattern
Following Repository Pattern:
- **Stores**: Pure reactive state (subscribe, set, update, helper methods)
- **Repositories**: Handle persistence (load/save/delete), storage API calls
- Location: `src/lib/stores/*.ts` and `src/lib/repositories/*.ts`

## Documentation
- Use JSDoc for functions and complex types
- Include type annotations for function parameters and return types

## Import Organization
1. Svelte/SvelteKit imports
2. Third-party libraries
3. Internal types
4. Internal modules (stores, storage, etc.)

## Testing
- Test files: `tests/**/*.test.ts`
- Test framework: Vitest
- Mock location: `tests/__mocks__/`
