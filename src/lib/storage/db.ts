import { readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';

const DB_FILENAME = 'terrarium.db';
const BASE = { baseDir: BaseDirectory.AppData };

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('event', 'trait', 'relationship', 'location', 'state')),
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  source_message_ids TEXT NOT NULL DEFAULT '[]',
  turn_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_type ON memories(session_id, type);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  start_turn INTEGER NOT NULL,
  end_turn INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id);

CREATE TABLE IF NOT EXISTS embeddings (
  memory_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_embeddings_memory ON embeddings(memory_id);

CREATE TABLE IF NOT EXISTS scene_states (
  session_id TEXT PRIMARY KEY,
  location TEXT NOT NULL DEFAULT '',
  characters TEXT NOT NULL DEFAULT '[]',
  atmosphere TEXT NOT NULL DEFAULT '',
  time_of_day TEXT NOT NULL DEFAULT '',
  environmental_notes TEXT NOT NULL DEFAULT '',
  last_updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS character_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  emotion TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  inventory TEXT NOT NULL DEFAULT '[]',
  health TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_character_states_session ON character_states(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_character_states_session_name ON character_states(session_id, character_name);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<any> | null = null;

async function loadSqlJs() {
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });
  return SQL;
}

export async function getDb() {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await loadSqlJs();
      try {
        const data = await readFile(DB_FILENAME, BASE);
        db = new SQL.Database(new Uint8Array(data));
      } catch {
        db = new SQL.Database();
      }
      db.run(SCHEMA_SQL);
      dbPromise = null;
      return db;
    })();
  }
  return dbPromise;
}

export async function persist() {
  const database = await getDb();
  const data = database.export();
  await writeFile(DB_FILENAME, data, BASE);
}

export async function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
