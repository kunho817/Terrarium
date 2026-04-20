# Terrarium Project Instructions

Terrarium is a SvelteKit 2, Svelte 5, TypeScript, and Tauri v2 desktop AI chatbot. Treat this repository as an active worktree: inspect existing changes before editing and do not overwrite unrelated user work.

## Working Rules

- For non-trivial tasks, load the `terrarium-analyze` skill first to classify affected domains and test files.
- Prefer existing project patterns over new abstractions.
- Keep changes scoped to the requested behavior.
- Do not edit generated or dependency directories: `node_modules/`, `.opencode/node_modules/`, `.svelte-kit/`, `build/`, or `src-tauri/target/`.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) for component state.
- Use `@tauri-apps/plugin-http` for streaming provider requests; do not replace it with browser `fetch` for streaming paths.
- Keep plugin-style extension points for providers, card formats, image providers, and prompt builders.
- Mirror test structure under `tests/` when adding or changing behavior.
- Prefer `npm run check` for type/Svelte validation and targeted `npm run test -- <pattern>` or `npm run test` for behavior changes.

## Current Project Commands

- `npm run dev` starts the SvelteKit dev server.
- `npm run tauri dev` starts the Tauri desktop app in development mode.
- `npm run check` runs SvelteKit sync and Svelte type checking.
- `npm run test` runs the Vitest suite.
- `npm run build` builds the web app.
