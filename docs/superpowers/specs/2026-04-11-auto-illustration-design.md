# Auto Illustration — Design

**Date:** 2026-04-11
**Scope:** NovelAI + ComfyUI image generation, inline in chat, 2-pass LLM-driven prompt construction

## Overview

A 2-pass image generation system integrated into chat. When triggered (automatically after AI response or manually via button), the system:

1. **Pass 1 (LLM)**: Sends chat context + art style preset instructions to the same LLM used for chat, requesting an image prompt
2. **Pass 2 (Image Provider)**: Sends LLM-generated prompt + art style positive/negative prompts to NovelAI or ComfyUI
3. Generated image displayed inline in chat

## New Types

### ArtStylePreset
```typescript
interface ArtStylePreset {
  id: string;
  name: string;
  positivePrompt: string;   // appended to image prompt
  negativePrompt: string;   // appended to negative prompt
}
```

### ImageGenerationConfig (in AppSettings)
```typescript
interface ImageGenerationConfig {
  provider: 'novelai' | 'comfyui' | 'none';
  autoGenerate: boolean;          // auto-trigger after each AI response
  artStylePresetId: string;       // selected art style preset
  imagePromptInstructions: string; // system instructions for LLM to generate image prompt
  novelai: {
    apiKey: string;
    model: string;        // e.g. 'nai-diffusion-4-5-full'
    width: number;        // default 832
    height: number;       // default 1216
    steps: number;        // default 28
    scale: number;        // default 5
    sampler: string;      // default 'k_euler_ancestral'
  };
  comfyui: {
    url: string;          // default 'http://localhost:8188'
    workflow: string;     // JSON workflow with {{risu_prompt}} and {{risu_neg}} placeholders
    timeout: number;      // seconds, default 60
  };
}
```

### Message Extension
```typescript
// In Message type, add optional image field
interface Message {
  // ... existing fields
  image?: {
    filename: string;     // relative path in AppData
    prompt: string;       // the image prompt used (for debugging)
  };
}
```

## Architecture

### ImageGenerator (core service)
```typescript
// src/lib/core/image/generator.ts
class ImageGenerator {
  constructor(registry: PluginRegistry) {}

  async generateForChat(context: {
    messages: Message[];
    card: CharacterCard;
    scene: SceneState;
    config: UserConfig;
    artStyle: ArtStylePreset;
    imageConfig: ImageGenerationConfig;
    preset?: PromptPreset;
  }): Promise<{ filename: string; prompt: string } | null>
}
```

**Flow:**
1. Build LLM prompt: system instruction = `imagePromptInstructions`, user message = recent chat context
2. Call the same provider as chat via `registry.getProvider(config.providerId)`
3. Collect full LLM response (not streaming — use a simple fetch or collect all tokens)
4. Combine: `finalPositive = artStyle.positivePrompt + ", " + llmResponse`
5. Combine: `finalNegative = artStyle.negativePrompt`
6. Call `registry.getImageProvider(imageConfig.provider).generateImage()`
7. Save image to `images/{charId}/{sessionId}/{timestamp}.png`
8. Return `{ filename, prompt }`

### NovelAI Provider
```typescript
// src/lib/plugins/image-providers/novelai.ts
```
- Endpoint: `https://image.novelai.net/ai/generate-image`
- Auth: Bearer token (API key)
- Request: JSON with model, prompt, parameters
- Response: ZIP file — extract first image
- Config fields: API key, model, width, height, steps, scale, sampler

### ComfyUI Provider
```typescript
// src/lib/plugins/image-providers/comfyui.ts
```
- Endpoint: `{url}/prompt` for submit, `{url}/history` for polling, `{url}/view` for retrieval
- Submit workflow JSON with `{{risu_prompt}}` and `{{risu_neg}}` replaced
- Poll `/history/{prompt_id}` until complete
- Retrieve image from `/view?filename=...`
- Config fields: URL, workflow JSON, timeout

### Default Art Style Presets
```typescript
const DEFAULT_ART_PRESETS: ArtStylePreset[] = [
  {
    id: 'anime',
    name: 'Anime',
    positivePrompt: 'masterpiece, best quality, anime style, detailed',
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, normal quality, jpeg artifacts',
  },
  {
    id: 'realistic',
    name: 'Realistic',
    positivePrompt: 'photorealistic, detailed, high quality, 8k, sharp focus',
    negativePrompt: 'anime, cartoon, illustration, painting, drawing, art, sketch, lowres, bad anatomy, text',
  },
  {
    id: 'custom',
    name: 'Custom',
    positivePrompt: '',
    negativePrompt: '',
  },
];
```

### Default LLM Image Prompt Instructions
```
You are an image prompt generator for a roleplay scene. Based on the conversation context, generate a detailed image prompt describing the current scene. Focus on:
- Character appearance and pose
- Environment and atmosphere
- Lighting and mood
- Composition and camera angle

Output ONLY the image prompt text, nothing else. Keep it under 200 tokens. Use comma-separated tags and descriptive phrases. Do not include any explanations or meta-text.
```

## UI Components

### Image Generation Settings
- Location: `/settings/image-generation` (new route)
- Sections:
  - Provider selection (None / NovelAI / ComfyUI)
  - Auto-generate toggle
  - Art style preset selector + editor (create, edit, delete presets)
  - Provider-specific settings (model, size, steps, etc. for NAI; URL, workflow, timeout for ComfyUI)

### Generate Button (in chat)
- Small camera/image icon button in chat input area
- Click → manual trigger for current scene
- Disabled when no image provider configured

### Image Display in MessageItem
- When `message.image` exists, render `<img>` below text content
- Click to view full size (simple modal)
- Styled with rounded corners, max-width constraint

## File Storage

Images saved via Tauri filesystem:
- Path: `{AppData}/images/{charId}/{sessionId}/{timestamp}.png`
- Message stores relative path
- `MessageList` resolves to full path for display

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/types/art-style.ts` | New — ArtStylePreset type |
| `src/lib/types/image-config.ts` | New — ImageGenerationConfig type |
| `src/lib/types/message.ts` | Modify — add image field |
| `src/lib/core/image/generator.ts` | New — ImageGenerator class |
| `src/lib/plugins/image-providers/novelai.ts` | New — NovelAI provider |
| `src/lib/plugins/image-providers/comfyui.ts` | New — ComfyUI provider |
| `src/lib/plugins/image-providers/index.ts` | New — barrel export |
| `src/lib/core/bootstrap.ts` | Modify — register image providers |
| `src/lib/storage/settings.ts` | Modify — add imageGeneration config |
| `src/lib/stores/settings.ts` | Modify — add imageGeneration to initial state |
| `src/routes/settings/image-generation/+page.svelte` | New — settings page |
| `src/lib/components/MessageItem.svelte` | Modify — show inline images |
| `src/lib/components/ChatInput.svelte` | Modify — add generate button |
| `src/lib/components/ImageModal.svelte` | New — full-size image viewer |
