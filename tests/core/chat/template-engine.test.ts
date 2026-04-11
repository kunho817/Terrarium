import { describe, it, expect } from 'vitest';
import { substituteVariables } from '$lib/core/chat/template-engine';
import type { TemplateVariables } from '$lib/core/chat/template-engine';

function makeVars(overrides: Partial<TemplateVariables> = {}): TemplateVariables {
  return {
    char: 'Alice',
    user: 'Bob',
    description: 'A curious girl.',
    personality: 'Cheerful and brave.',
    scenario: 'Wonderland.',
    exampleMessages: 'Hello!',
    slot: 'main',
    sceneLocation: 'Garden',
    sceneTime: 'Afternoon',
    sceneMood: 'Dreamy',
    variables: {},
    userPersona: '',
    userDescription: '',
    userExampleDialogue: '',
    ...overrides,
  };
}

describe('substituteVariables', () => {
  it('replaces {{char}}', () => {
    expect(substituteVariables('{{char}} is here.', makeVars())).toBe('Alice is here.');
  });

  it('replaces {{char.name}}', () => {
    expect(substituteVariables('{{char.name}} is here.', makeVars())).toBe('Alice is here.');
  });

  it('replaces {{char.name}} before {{char}} to avoid partial match', () => {
    expect(
      substituteVariables('{{char.name}} and {{char}} are different.', makeVars()),
    ).toBe('Alice and Alice are different.');
  });

  it('replaces {{user}}', () => {
    expect(substituteVariables('Welcome, {{user}}.', makeVars())).toBe('Welcome, Bob.');
  });

  it('replaces {{description}}', () => {
    expect(substituteVariables('Desc: {{description}}', makeVars())).toBe('Desc: A curious girl.');
  });

  it('replaces {{personality}}', () => {
    expect(substituteVariables('Trait: {{personality}}', makeVars())).toBe('Trait: Cheerful and brave.');
  });

  it('replaces {{scenario}}', () => {
    expect(substituteVariables('Set in {{scenario}}', makeVars())).toBe('Set in Wonderland.');
  });

  it('replaces {{example_messages}}', () => {
    expect(substituteVariables('Msg: {{example_messages}}', makeVars())).toBe('Msg: Hello!');
  });

  it('replaces {{slot}}', () => {
    expect(substituteVariables('Slot: {{slot}}', makeVars())).toBe('Slot: main');
  });

  it('replaces {{scene.location}}', () => {
    expect(substituteVariables('At {{scene.location}}', makeVars())).toBe('At Garden');
  });

  it('replaces {{scene.time}}', () => {
    expect(substituteVariables('Time: {{scene.time}}', makeVars())).toBe('Time: Afternoon');
  });

  it('replaces {{scene.mood}}', () => {
    expect(substituteVariables('Mood: {{scene.mood}}', makeVars())).toBe('Mood: Dreamy');
  });

  it('replaces multiple variables in one string', () => {
    const result = substituteVariables(
      '{{char}} meets {{user}} at {{scene.location}}.',
      makeVars(),
    );
    expect(result).toBe('Alice meets Bob at Garden.');
  });

  it('replaces {{var.X}} from variables record', () => {
    const vars = makeVars({ variables: { weather: 'sunny', season: 'summer' } });
    expect(substituteVariables('Weather: {{var.weather}}, Season: {{var.season}}', vars)).toBe(
      'Weather: sunny, Season: summer',
    );
  });

  it('replaces unknown {{var.X}} with empty string', () => {
    const vars = makeVars({ variables: {} });
    expect(substituteVariables('Value: {{var.missing}}', vars)).toBe('Value: ');
  });

  it('replaces unknown non-var variables with empty string', () => {
    expect(substituteVariables('Hello {{unknown}}!', makeVars())).toBe('Hello !');
  });

  it('returns empty string for empty input', () => {
    expect(substituteVariables('', makeVars())).toBe('');
  });

  it('returns original text when no variables present', () => {
    const text = 'Just a plain string.';
    expect(substituteVariables(text, makeVars())).toBe(text);
  });

  it('handles numeric values in variables record', () => {
    const vars = makeVars({ variables: { count: 42 } });
    expect(substituteVariables('Count: {{var.count}}', vars)).toBe('Count: 42');
  });

  it('handles boolean values in variables record', () => {
    const vars = makeVars({ variables: { active: true } });
    expect(substituteVariables('Active: {{var.active}}', vars)).toBe('Active: true');
  });

  it('handles underscores in var keys', () => {
    const vars = makeVars({ variables: { my_key: 'value' } });
    expect(substituteVariables('{{var.my_key}}', vars)).toBe('value');
  });

  it('replaces {{user_persona}}', () => {
    const vars = makeVars({ userPersona: 'A brave warrior.' });
    expect(substituteVariables('Persona: {{user_persona}}', vars)).toBe('Persona: A brave warrior.');
  });

  it('replaces {{user_description}}', () => {
    const vars = makeVars({ userDescription: 'Tall and strong.' });
    expect(substituteVariables('Desc: {{user_description}}', vars)).toBe('Desc: Tall and strong.');
  });

  it('replaces {{user_example_dialogue}}', () => {
    const vars = makeVars({ userExampleDialogue: 'Bob: "Hello!"' });
    expect(substituteVariables('Ex: {{user_example_dialogue}}', vars)).toBe('Ex: Bob: "Hello!"');
  });

  it('replaces {user} single-brace with user name', () => {
    expect(substituteVariables('Hello {user}!', makeVars())).toBe('Hello Bob!');
  });

  it('replaces {char} single-brace with char name', () => {
    expect(substituteVariables('{char} is here.', makeVars())).toBe('Alice is here.');
  });

  it('does not replace unknown single-brace patterns', () => {
    expect(substituteVariables('Use {variable} here.', makeVars())).toBe('Use {variable} here.');
  });
});
