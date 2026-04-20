import { PROMPTS } from './prompts';
import type { TurnMaintenanceOutput, ExtractionSnapshot } from './types';

export function formatTurnMaintenanceInjection(tmo: TurnMaintenanceOutput): string {
  const sections: string[] = [];

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
    sections.push(lines.join('\n'));
  }

  const dir = tmo.director;
  if (dir.sceneMandate || dir.requiredOutcomes.length || dir.forbiddenMoves.length || dir.emphasis.length) {
    const lines: string[] = ['[Director Supervision]'];
    if (dir.sceneMandate) lines.push(`Scene Mandate: ${dir.sceneMandate}`);
    if (dir.requiredOutcomes.length) lines.push(`Required Outcomes: ${dir.requiredOutcomes.join(', ')}`);
    if (dir.forbiddenMoves.length) lines.push(`Forbidden Moves: ${dir.forbiddenMoves.join(', ')}`);
    if (dir.emphasis.length) lines.push(`Emphasis: ${dir.emphasis.join(', ')}`);
    lines.push(`Target Pacing: ${dir.targetPacing}`);
    lines.push(`Pressure Level: ${dir.pressureLevel}`);
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

export function formatExtractionInjection(snap: ExtractionSnapshot): string | undefined {
  const sections: string[] = [];

  const hasScene = snap.scene.location || snap.scene.characters.length > 0
    || snap.scene.atmosphere || snap.scene.timeOfDay || snap.scene.environmentalNotes;

  if (hasScene) {
    const lines: string[] = ['[Scene State]'];
    if (snap.scene.location) lines.push(`Location: ${snap.scene.location}`);
    if (snap.scene.characters.length) lines.push(`Characters Present: ${snap.scene.characters.join(', ')}`);
    if (snap.scene.atmosphere) lines.push(`Atmosphere: ${snap.scene.atmosphere}`);
    if (snap.scene.timeOfDay) lines.push(`Time: ${snap.scene.timeOfDay}`);
    if (snap.scene.environmentalNotes) lines.push(`Environment: ${snap.scene.environmentalNotes}`);
    sections.push(lines.join('\n'));
  }

  const charEntries = Object.values(snap.characters);
  if (charEntries.length > 0) {
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
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export function formatReliabilityGuard(): string {
  return PROMPTS.get('RELIABILITY_GUARD');
}

export function formatMemoryInjection(memories: Array<{ content: string; type: string }>): string | undefined {
  if (memories.length === 0) return undefined;

  const lines: string[] = ['[Memory]'];
  for (const mem of memories) {
    lines.push(`- ${mem.content} (${mem.type})`);
  }
  return lines.join('\n');
}
