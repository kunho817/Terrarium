import { getDb, persist } from './db';
import type { SessionAgentState } from '$lib/core/agents/types';

export async function loadSessionState(sessionId: string): Promise<SessionAgentState | null> {
  const db = await getDb();
  const result = db.exec(
    'SELECT state FROM session_agent_state WHERE session_id = ?',
    [sessionId],
  );
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  const raw = result[0].values[0][0] as string;
  try {
    return JSON.parse(raw) as SessionAgentState;
  } catch {
    console.warn(`[SessionAgentState] Failed to parse state for session ${sessionId}`);
    return null;
  }
}

export async function saveSessionState(state: SessionAgentState): Promise<void> {
  const db = await getDb();
  const json = JSON.stringify(state);
  const now = Date.now();
  const existing = db.exec(
    'SELECT session_id FROM session_agent_state WHERE session_id = ?',
    [state.sessionId],
  );
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(
      'UPDATE session_agent_state SET state = ?, updated_at = ? WHERE session_id = ?',
      [json, now, state.sessionId],
    );
  } else {
    db.run(
      'INSERT INTO session_agent_state (session_id, state, updated_at) VALUES (?, ?, ?)',
      [state.sessionId, json, now],
    );
  }
  try { await persist(); } catch {}
}

export async function deleteSessionState(sessionId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM session_agent_state WHERE session_id = ?', [sessionId]);
  try { await persist(); } catch {}
}
