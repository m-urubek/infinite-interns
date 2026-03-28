import type { Plugin, Connect } from 'vite';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { IncomingMessage } from 'http';
import { createDefaultPreset } from '../types/preset';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../presets.db');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'google',
      maxRpm INTEGER,
      maxTpm INTEGER,
      maxRpd INTEGER,
      maxSpending REAL,
      buildCommand TEXT NOT NULL DEFAULT '',
      buildCommandAutoDetect INTEGER NOT NULL DEFAULT 1,
      businessClarificationsMode TEXT NOT NULL DEFAULT 'interactive',
      technicalClarificationsMode TEXT NOT NULL DEFAULT 'disabled',
      microplanner INTEGER NOT NULL DEFAULT 1,
      builder INTEGER NOT NULL DEFAULT 1,
      microVerifier INTEGER NOT NULL DEFAULT 1,
      finalVerifier INTEGER NOT NULL DEFAULT 1,
      businessClarificationRounds INTEGER NOT NULL DEFAULT 5,
      technicalClarificationRounds INTEGER NOT NULL DEFAULT 5,
      maxImplementationAttempts INTEGER NOT NULL DEFAULT 7,
      documentationEnabled INTEGER NOT NULL DEFAULT 0,
      documentationIndexPath TEXT NOT NULL DEFAULT '',
      docsFolderPath TEXT NOT NULL DEFAULT '',
      backends TEXT NOT NULL DEFAULT '{}',
      customRules TEXT NOT NULL DEFAULT '{}',
      retryAttempts TEXT NOT NULL DEFAULT '{}',
      agentModelConfigs TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS thread_presets (
      threadId TEXT PRIMARY KEY,
      presetId TEXT NOT NULL
    );
  `);

  // Migration: add new columns if they don't exist (for existing databases)
  migrateSchema(db);

  // Seed default preset if table is empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM presets').get() as { cnt: number };
  if (count.cnt === 0) {
    const preset = createDefaultPreset();
    insertPreset(db, preset);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'selectedPresetId',
      preset.id,
    );
  }
}

function migrateSchema(db: Database.Database): void {
  // Get current columns
  const columns = db.prepare("PRAGMA table_info('presets')").all() as { name: string }[];
  const columnNames = new Set(columns.map((c) => c.name));

  // Migrate old boolean clarification fields to mode strings
  if (columnNames.has('businessClarifications') && !columnNames.has('businessClarificationsMode')) {
    db.exec("ALTER TABLE presets ADD COLUMN businessClarificationsMode TEXT NOT NULL DEFAULT 'interactive'");
    db.exec("UPDATE presets SET businessClarificationsMode = CASE WHEN businessClarifications = 0 THEN 'disabled' ELSE 'interactive' END");
  }
  if (columnNames.has('technicalClarifications') && !columnNames.has('technicalClarificationsMode')) {
    db.exec("ALTER TABLE presets ADD COLUMN technicalClarificationsMode TEXT NOT NULL DEFAULT 'disabled'");
    db.exec("UPDATE presets SET technicalClarificationsMode = CASE WHEN technicalClarifications = 0 THEN 'disabled' ELSE 'interactive' END");
  }

  // Add new documentation columns
  if (!columnNames.has('documentationEnabled')) {
    db.exec('ALTER TABLE presets ADD COLUMN documentationEnabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnNames.has('documentationIndexPath')) {
    db.exec("ALTER TABLE presets ADD COLUMN documentationIndexPath TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has('docsFolderPath')) {
    db.exec("ALTER TABLE presets ADD COLUMN docsFolderPath TEXT NOT NULL DEFAULT ''");
  }
}

type PresetRow = {
  id: string;
  name: string;
  provider: string;
  maxRpm: number | null;
  maxTpm: number | null;
  maxRpd: number | null;
  maxSpending: number | null;
  buildCommand: string;
  buildCommandAutoDetect: number;
  businessClarificationsMode: string;
  technicalClarificationsMode: string;
  microplanner: number;
  builder: number;
  microVerifier: number;
  finalVerifier: number;
  businessClarificationRounds: number;
  technicalClarificationRounds: number;
  maxImplementationAttempts: number;
  documentationEnabled: number;
  documentationIndexPath: string;
  docsFolderPath: string;
  backends: string;
  customRules: string;
  retryAttempts: string;
  agentModelConfigs: string;
};

function rowToPreset(row: PresetRow) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as 'google' | 'openai' | 'deepseek',
    maxRpm: row.maxRpm,
    maxTpm: row.maxTpm,
    maxRpd: row.maxRpd,
    maxSpending: row.maxSpending,
    buildCommand: row.buildCommand,
    buildCommandAutoDetect: !!row.buildCommandAutoDetect,
    businessClarificationsMode: row.businessClarificationsMode as 'disabled' | 'interactive' | 'auto',
    technicalClarificationsMode: row.technicalClarificationsMode as 'disabled' | 'interactive' | 'auto',
    microplanner: !!row.microplanner,
    builder: !!row.builder,
    microVerifier: !!row.microVerifier,
    finalVerifier: !!row.finalVerifier,
    businessClarificationRounds: row.businessClarificationRounds,
    technicalClarificationRounds: row.technicalClarificationRounds,
    maxImplementationAttempts: row.maxImplementationAttempts,
    documentationEnabled: !!row.documentationEnabled,
    documentationIndexPath: row.documentationIndexPath,
    docsFolderPath: row.docsFolderPath,
    backends: JSON.parse(row.backends),
    customRules: JSON.parse(row.customRules),
    retryAttempts: JSON.parse(row.retryAttempts),
    agentModelConfigs: JSON.parse(row.agentModelConfigs),
  };
}

function insertPreset(db: Database.Database, preset: ReturnType<typeof createDefaultPreset>): void {
  db.prepare(`
    INSERT INTO presets (
      id, name, provider, maxRpm, maxTpm, maxRpd, maxSpending,
      buildCommand, buildCommandAutoDetect,
      businessClarificationsMode, technicalClarificationsMode,
      microplanner, builder,
      microVerifier, finalVerifier, businessClarificationRounds,
      technicalClarificationRounds, maxImplementationAttempts,
      documentationEnabled, documentationIndexPath, docsFolderPath,
      backends, customRules, retryAttempts, agentModelConfigs
    ) VALUES (
      @id, @name, @provider, @maxRpm, @maxTpm, @maxRpd, @maxSpending,
      @buildCommand, @buildCommandAutoDetect,
      @businessClarificationsMode, @technicalClarificationsMode,
      @microplanner, @builder,
      @microVerifier, @finalVerifier, @businessClarificationRounds,
      @technicalClarificationRounds, @maxImplementationAttempts,
      @documentationEnabled, @documentationIndexPath, @docsFolderPath,
      @backends, @customRules, @retryAttempts, @agentModelConfigs
    )
  `).run({
    ...preset,
    buildCommandAutoDetect: preset.buildCommandAutoDetect ? 1 : 0,
    documentationEnabled: preset.documentationEnabled ? 1 : 0,
    microplanner: preset.microplanner ? 1 : 0,
    builder: preset.builder ? 1 : 0,
    microVerifier: preset.microVerifier ? 1 : 0,
    finalVerifier: preset.finalVerifier ? 1 : 0,
    backends: JSON.stringify(preset.backends),
    customRules: JSON.stringify(preset.customRules),
    retryAttempts: JSON.stringify(preset.retryAttempts),
    agentModelConfigs: JSON.stringify(preset.agentModelConfigs),
  });
}

function json(res: Connect.ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function presetsApiPlugin(): Plugin {
  let db: Database.Database;

  return {
    name: 'presets-api',
    configureServer(server) {
      db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      initDb(db);

      server.middlewares.use(async (req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) => {
        const url = req.url ?? '';
        const method = req.method ?? 'GET';

        // GET /api/presets
        if (url === '/api/presets' && method === 'GET') {
          const rows = db.prepare('SELECT * FROM presets').all() as PresetRow[];
          json(res, rows.map(rowToPreset));
          return;
        }

        // GET /api/presets/selected
        if (url === '/api/presets/selected' && method === 'GET') {
          const row = db.prepare("SELECT value FROM settings WHERE key = 'selectedPresetId'").get() as
            | { value: string }
            | undefined;
          json(res, { id: row?.value ?? null });
          return;
        }

        // PUT /api/presets/selected
        if (url === '/api/presets/selected' && method === 'PUT') {
          const body = JSON.parse(await readBody(req));
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
            'selectedPresetId',
            body.id,
          );
          json(res, { ok: true });
          return;
        }

        // POST /api/presets
        if (url === '/api/presets' && method === 'POST') {
          const body = JSON.parse(await readBody(req));
          const preset = { ...createDefaultPreset(), ...body, id: uuidv4() };
          insertPreset(db, preset);
          const row = db.prepare('SELECT * FROM presets WHERE id = ?').get(preset.id) as PresetRow;
          json(res, rowToPreset(row), 201);
          return;
        }

        // PUT /api/presets/:id
        const putMatch = url.match(/^\/api\/presets\/([^/]+)$/);
        if (putMatch && method === 'PUT') {
          const id = putMatch[1];
          const body = JSON.parse(await readBody(req));

          const existing = db.prepare('SELECT * FROM presets WHERE id = ?').get(id) as
            | PresetRow
            | undefined;
          if (!existing) {
            json(res, { error: 'Not found' }, 404);
            return;
          }

          // Build SET clause dynamically from body keys
          const updates: string[] = [];
          const values: Record<string, unknown> = { id };

          for (const [key, value] of Object.entries(body)) {
            if (key === 'id') continue;
            const booleanFields = [
              'buildCommandAutoDetect',
              'documentationEnabled',
              'microplanner',
              'builder',
              'microVerifier',
              'finalVerifier',
            ];
            const jsonFields = ['backends', 'customRules', 'retryAttempts', 'agentModelConfigs'];

            if (booleanFields.includes(key)) {
              updates.push(`${key} = @${key}`);
              values[key] = value ? 1 : 0;
            } else if (jsonFields.includes(key)) {
              updates.push(`${key} = @${key}`);
              values[key] = JSON.stringify(value);
            } else {
              updates.push(`${key} = @${key}`);
              values[key] = value;
            }
          }

          if (updates.length > 0) {
            db.prepare(`UPDATE presets SET ${updates.join(', ')} WHERE id = @id`).run(values);
          }

          const updated = db.prepare('SELECT * FROM presets WHERE id = ?').get(id) as PresetRow;
          json(res, rowToPreset(updated));
          return;
        }

        // DELETE /api/presets/:id
        const deleteMatch = url.match(/^\/api\/presets\/([^/]+)$/);
        if (deleteMatch && method === 'DELETE') {
          const id = deleteMatch[1];
          db.prepare('DELETE FROM presets WHERE id = ?').run(id);

          // If deleted was selected, clear selection
          const selected = db.prepare("SELECT value FROM settings WHERE key = 'selectedPresetId'").get() as
            | { value: string }
            | undefined;
          if (selected?.value === id) {
            db.prepare("DELETE FROM settings WHERE key = 'selectedPresetId'").run();
          }

          json(res, { ok: true });
          return;
        }

        // GET /api/thread-presets/:threadId
        const threadGetMatch = url.match(/^\/api\/thread-presets\/([^/]+)$/);
        if (threadGetMatch && method === 'GET') {
          const threadId = threadGetMatch[1];
          const row = db.prepare('SELECT presetId FROM thread_presets WHERE threadId = ?').get(threadId) as
            | { presetId: string }
            | undefined;
          if (row) {
            json(res, { presetId: row.presetId });
          } else {
            json(res, { error: 'Not found' }, 404);
          }
          return;
        }

        // POST /api/thread-presets
        if (url === '/api/thread-presets' && method === 'POST') {
          const body = JSON.parse(await readBody(req));
          db.prepare('INSERT OR REPLACE INTO thread_presets (threadId, presetId) VALUES (?, ?)').run(
            body.threadId,
            body.presetId,
          );
          json(res, { ok: true });
          return;
        }

        next();
      });
    },
  };
}
