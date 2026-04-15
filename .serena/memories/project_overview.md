# Project Overview: Terrarium

## Purpose
Terrarium is an AI chatbot application built with Svelte 5 and Tauri. It provides a desktop application for roleplaying with AI characters and worlds.

## Tech Stack
- **Frontend Framework**: Svelte 5 (with SvelteKit)
- **Backend/Runtime**: Tauri (Rust-based desktop framework)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript (strict mode enabled)
- **Build Tool**: Vite 6
- **Testing**: Vitest
- **Storage**: sql.js (SQLite in browser)

## Project Structure
```
src/
├── lib/
│   ├── components/     # Reusable UI components
│   ├── core/          # Core business logic (chat engine, agents, scripting)
│   ├── plugins/       # Plugin system (providers, card formats, prompt builders)
│   ├── storage/       # Data persistence layer
│   ├── stores/        # Svelte stores (reactive state)
│   └── types/         # TypeScript type definitions
├── routes/            # SvelteKit routes (file-based routing)
│   ├── characters/    # Character management pages
│   ├── chat/[id]/     # Chat interface
│   ├── settings/      # Settings pages
│   └── worlds/        # World management pages
└── app.html          # HTML template

docs/                  # Documentation (design specs, plans)
tests/                 # Test files
src-tauri/            # Tauri Rust backend
```

## Key Features
- AI character cards support (SillyTavern, RisuAI formats)
- World cards for group roleplay scenarios
- Plugin-based AI provider system
- Memory system with embeddings
- Image generation integration
- Lua scripting support
- Lorebook and trigger system
