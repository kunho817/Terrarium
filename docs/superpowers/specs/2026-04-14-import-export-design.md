# Import/Export Design

## Overview

Add full import/export UI for both World Cards and Character Cards. World cards get a standalone import/export utility with a native `.tcworld` format. Character cards gain export UI leveraging the existing `CardFormatPlugin.export()` methods.

## World Card Import/Export

### `.tcworld` Format

Plain JSON with a spec wrapper:

```json
{
  "spec": "tcworld",
  "specVersion": "1.0",
  "data": { ...WorldCard }
}
```

The `data` field contains a standard `WorldCard` object. The `spec` and `specVersion` fields enable format detection and future versioning.

### Standalone Utility Module

**File:** `src/lib/storage/world-import.ts`

No plugin abstraction — simple function pairs:

- `validateWorldCard(data: ArrayBuffer): boolean` — checks JSON, verifies `spec === 'tcworld'` and required `data` fields (`name`, `description`)
- `parseWorldCard(data: ArrayBuffer): WorldCard` — validates then returns `data` field as `WorldCard`, filling defaults for missing optional fields
- `exportWorldCard(card: WorldCard): ArrayBuffer` — wraps in spec envelope and serializes to JSON

### Import UI

On the worlds list page (`/worlds`), an "Import" button next to "Create". Opens Tauri file picker accepting `.tcworld` files (multiple). For each file:

1. Read file into `ArrayBuffer`
2. `parseWorldCard(data)` → `WorldCard`
3. `worldStorage.createWorld(card)` → assigns new UUID
4. Refresh world list

### Export UI

Two locations:

- **Worlds list page** — per-world export button (visible on hover, same pattern as edit/delete)
- **World editor page** — "Export" button in the header next to "Chat" and "Save"

Export flow:

1. Load world card
2. `exportWorldCard(card)` → `ArrayBuffer`
3. Tauri `save()` dialog with default filename `{worldName}.tcworld`
4. Write buffer to chosen path

## Character Card Export

### Existing Infrastructure

All three `CardFormatPlugin` implementations already have working `export()` methods:

| Plugin | ID | Extension |
|--------|------|-----------|
| RisuAI | `risuai` | `.json` |
| SillyTavern | `sillytavern` | (no extension) |
| Generic JSON | `generic-json` | `.tcjson` |

No plugin code changes needed — only UI.

### Export UI

Two locations:

- **Characters list page** — per-character export button (visible on hover)
- **Character editor page** — "Export" button in the header next to "Save"

Export flow:

1. Click "Export" → dropdown with format choices: "Terrarium (.tcjson)", "RisuAI (.json)", "SillyTavern (.json)"
2. Load character card from store
3. `format.export(card)` → `ArrayBuffer`
4. Tauri `save()` dialog with default filename `{charName}.{ext}`
5. Write buffer to chosen path

### Format Selection

The export button shows a small dropdown/popover on click with three format options. Default selection is `.tcjson` (native, lossless roundtrip). RisuAI and SillyTavern are alternatives for cross-platform sharing.

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/lib/storage/world-import.ts` | `validateWorldCard`, `parseWorldCard`, `exportWorldCard` |
| `tests/storage/world-import.test.ts` | Tests for parse/validate/export |

### Modified Files

| File | Changes |
|------|---------|
| `src/routes/worlds/+page.svelte` | Add import button, per-world export button |
| `src/routes/worlds/[id]/edit/+page.svelte` | Add export button in header |
| `src/routes/characters/+page.svelte` | Add per-character export button with format dropdown |
| `src/routes/characters/[id]/edit/+page.svelte` | Add export button in header |

## Error Handling

- Import: invalid files show an error banner with the filename and reason
- Export: filesystem errors (permission denied, disk full) show an error banner
- Both: errors are non-blocking — one failing file in a multi-file import doesn't stop the rest

## Testing

- Unit tests for `validateWorldCard`, `parseWorldCard`, `exportWorldCard` in `tests/storage/world-import.test.ts`
- Roundtrip test: `export(parse(data))` produces equivalent output
- Validation tests: rejects non-JSON, wrong spec, missing required fields
- Default-filling tests: optional fields get defaults when missing from input
