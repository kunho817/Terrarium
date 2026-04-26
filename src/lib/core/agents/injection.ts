import { PROMPTS } from './prompts';
import type { TurnMaintenanceOutput, ExtractionSnapshot, SectionWorldOutput, SessionAgentState } from './types';
import type { SessionSummary } from '$lib/types/memory';
import type { AgentImageContext } from '$lib/core/image/generator';

function formatLabeledList(
  header: string,
  items: Array<{ content: string; type?: string }>,
): string | undefined {
  if (items.length === 0) return undefined;

  const lines: string[] = [header];
  for (const item of items) {
    if (item.type) {
      lines.push(`- ${item.content} (${item.type})`);
    } else {
      lines.push(`- ${item.content}`);
    }
  }
  return lines.join('\n');
}

export function formatTurnMaintenanceInjection(tmo: TurnMaintenanceOutput): string {
  const sections: string[] = [];

  const narrativeGuidance = formatNarrativeGuidanceInjection(tmo);
  if (narrativeGuidance) {
    sections.push(narrativeGuidance);
  }

  const directorGuidance = formatDirectorInjection(tmo);
  if (directorGuidance) {
    sections.push(directorGuidance);
  }

  return sections.join('\n\n');
}

export function formatExtractionInjection(snap: ExtractionSnapshot): string | undefined {
  const sections: string[] = [];

  const sceneState = formatSceneStateInjection(snap);
  if (sceneState) {
    sections.push(sceneState);
  }

  const characterState = formatCharacterStateInjection(snap);
  if (characterState) {
    sections.push(characterState);
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export function formatReliabilityGuard(): string {
  return PROMPTS.get('RELIABILITY_GUARD');
}

export function formatMemoryInjection(memories: Array<{ content: string; type: string }>): string | undefined {
  return formatLabeledList('[Memory]', memories);
}

export function formatPersistentMemoryInjection(memories: Array<{ content: string; type: string }>): string | undefined {
  return formatLabeledList('[Persistent Memory]', memories);
}

export function formatTurningPointInjection(items: string[]): string | undefined {
  return formatLabeledList(
    '[Turning Points]',
    items.map((content) => ({ content })),
  );
}

export function formatWorldMemoryInjection(memories: Array<{ content: string; type: string }>): string | undefined {
  return formatLabeledList('[World Encyclopedia]', memories);
}

export function formatArcMemoryInjection(
  state: SessionAgentState['narrativeState'],
  latestSummary?: string,
): string | undefined {
  const lines: string[] = ['[Arc Memory]'];

  if (state.currentArc) {
    lines.push(`Current Arc: ${state.currentArc}`);
  }
  if (state.activeTensions.length > 0) {
    lines.push(`Unresolved Tensions: ${state.activeTensions.join(', ')}`);
  }
  if (state.recentDecisions.length > 0) {
    lines.push(`Recent Decisions: ${state.recentDecisions.join(', ')}`);
  }
  if (state.nextBeats.length > 0) {
    lines.push(`Expected Beats: ${state.nextBeats.join(', ')}`);
  }
  if (latestSummary?.trim()) {
    lines.push(`Archived Context: ${latestSummary.trim()}`);
  }

  return lines.length > 1 ? lines.join('\n') : undefined;
}

export function formatSummaryInjection(summaries: SessionSummary[]): string | undefined {
  if (summaries.length === 0) return undefined;

  const lines: string[] = ['[Archived Summaries]'];
  for (const summary of summaries) {
    lines.push(`- Turns ${summary.startTurn}-${summary.endTurn}: ${summary.summary}`);
  }
  return lines.join('\n');
}

export function formatSectionWorldInjection(sw: SectionWorldOutput): string {
  const parts: string[] = [`[Section World: ${sw.sectionTitle}]`];
  parts.push(sw.prompt);
  if (sw.activeRules.length > 0) {
    parts.push(`Active Rules: ${sw.activeRules.join(', ')}`);
  }
  if (sw.scenePressures.length > 0) {
    parts.push(`Scene Pressures: ${sw.scenePressures.join(', ')}`);
  }
  return parts.join('\n');
}

export function formatNarrativeGuidanceInjection(
  tmo: TurnMaintenanceOutput,
  reliabilityGuard?: string,
): string | undefined {
  const sections: string[] = [];

  if (reliabilityGuard) {
    sections.push(reliabilityGuard);
  }

  if (tmo.narrativeBrief) {
    sections.push(`[Narrative Brief]\n${tmo.narrativeBrief}`);
  }

  const sa = tmo.storyAuthor;
  if (sa.currentArc || sa.narrativeGoal || sa.activeTensions.length || sa.nextBeats.length || sa.guardrails.length) {
    const lines: string[] = ['[Story Author Guidance]'];
    if (sa.currentArc) lines.push(`Current Arc: ${sa.currentArc}`);
    if (sa.narrativeGoal) lines.push(`Narrative Goal: ${sa.narrativeGoal}`);
    if (sa.activeTensions.length) lines.push(`Active Tensions: ${sa.activeTensions.join(', ')}`);
    if (sa.nextBeats.length) lines.push(`Next Beats: ${sa.nextBeats.join(', ')}`);
    if (sa.guardrails.length) lines.push(`Guardrails: ${sa.guardrails.join(', ')}`);
    if (sa.focusCharacters.length) lines.push(`Focus Characters: ${sa.focusCharacters.join(', ')}`);
    if (sa.recentDecisions.length) lines.push(`Recent Decisions: ${sa.recentDecisions.join(', ')}`);
    sections.push(lines.join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export function formatDirectorInjection(tmo: TurnMaintenanceOutput): string | undefined {
  const dir = tmo.director;
  if (!dir.sceneMandate && !dir.requiredOutcomes.length && !dir.forbiddenMoves.length && !dir.emphasis.length) {
    return undefined;
  }

  const lines: string[] = ['[Director Supervision]'];
  if (dir.sceneMandate) lines.push(`Scene Mandate: ${dir.sceneMandate}`);
  if (dir.requiredOutcomes.length) lines.push(`Required Outcomes: ${dir.requiredOutcomes.join(', ')}`);
  if (dir.forbiddenMoves.length) lines.push(`Forbidden Moves: ${dir.forbiddenMoves.join(', ')}`);
  if (dir.emphasis.length) lines.push(`Emphasis: ${dir.emphasis.join(', ')}`);
  if (dir.focusCharacters.length) lines.push(`Focus Characters: ${dir.focusCharacters.join(', ')}`);
  lines.push(`Target Pacing: ${dir.targetPacing}`);
  lines.push(`Pressure Level: ${dir.pressureLevel}`);
  return lines.join('\n');
}

export function formatSceneStateInjection(snap: ExtractionSnapshot): string | undefined {
  const hasScene = snap.scene.location || snap.scene.characters.length > 0
    || snap.scene.atmosphere || snap.scene.timeOfDay || snap.scene.environmentalNotes;

  if (!hasScene) {
    return undefined;
  }

  const lines: string[] = ['[Scene State]'];
  if (snap.scene.location) lines.push(`Location: ${snap.scene.location}`);
  if (snap.scene.characters.length) lines.push(`Characters Present: ${snap.scene.characters.join(', ')}`);
  if (snap.scene.atmosphere) lines.push(`Atmosphere: ${snap.scene.atmosphere}`);
  if (snap.scene.timeOfDay) lines.push(`Time: ${snap.scene.timeOfDay}`);
  if (snap.scene.environmentalNotes) lines.push(`Environment: ${snap.scene.environmentalNotes}`);
  return lines.join('\n');
}

export function formatCharacterStateInjection(snap: ExtractionSnapshot): string | undefined {
  const charEntries = Object.values(snap.characters);
  if (charEntries.length === 0) {
    return undefined;
  }

  const lines: string[] = ['[Character States]'];
  for (const cs of charEntries) {
    const details: string[] = [];
    if (cs.emotion) details.push(`feeling ${cs.emotion}`);
    if (cs.location) details.push(cs.location);
    if (cs.health && cs.health !== 'healthy') details.push(cs.health);
    if (cs.inventory.length > 0) details.push(`carrying: ${cs.inventory.join(', ')}`);
    if (cs.notes) details.push(cs.notes);
    if (details.length > 0) lines.push(`${cs.name}: ${details.join('; ')}`);
  }

  return lines.length > 1 ? lines.join('\n') : undefined;
}

export function formatWorldRelationsInjection(state: SessionAgentState): string | undefined {
  const entityEntries = Object.values(state.entities);
  const relationEntries = state.relations;
  const lines: string[] = ['[World Relations]'];

  if (entityEntries.length > 0) {
    lines.push('Entities:');
    for (const entity of entityEntries.slice(0, 12)) {
      const descriptor = [entity.type, entity.description].filter(Boolean).join(' - ');
      lines.push(`- ${entity.name}${descriptor ? `: ${descriptor}` : ''}`);
    }
  }

  if (relationEntries.length > 0) {
    lines.push('Relations:');
    for (const relation of relationEntries.slice(0, 12)) {
      const subject = state.entities[relation.subjectId]?.name ?? relation.subjectId;
      const object = state.entities[relation.objectId]?.name ?? relation.objectId;
      const detail = relation.description ? ` (${relation.description})` : '';
      lines.push(`- ${subject} -> ${object}: ${relation.relationType}${detail}`);
    }
  }

  return lines.length > 1 ? lines.join('\n') : undefined;
}

export function buildAgentImageContext(state: SessionAgentState): AgentImageContext {
  const ctx: AgentImageContext = {};

  if (state.lastExtraction) {
    const ext = state.lastExtraction;
    if (ext.scene.location) ctx.sceneLocation = ext.scene.location;
    if (ext.scene.timeOfDay) ctx.sceneTime = ext.scene.timeOfDay;
    if (ext.scene.atmosphere) ctx.sceneMood = ext.scene.atmosphere;

    const emotions: Record<string, string> = {};
    for (const [name, cs] of Object.entries(ext.characters)) {
      if (cs.emotion) emotions[name] = cs.emotion;
    }
    if (Object.keys(emotions).length > 0) ctx.characterEmotions = emotions;
  }

  if (state.lastTurnMaintenance) {
    const tmo = state.lastTurnMaintenance;
    if (tmo.director.sceneMandate) ctx.directorMandate = tmo.director.sceneMandate;
    if (tmo.director.emphasis.length > 0) ctx.directorEmphasis = tmo.director.emphasis;
    const focusCharacters = new Set([
      ...tmo.director.focusCharacters,
      ...tmo.storyAuthor.focusCharacters,
    ].filter(Boolean));
    if (focusCharacters.size > 0) {
      ctx.focusCharacters = Array.from(focusCharacters);
    }
  }

  return ctx;
}
