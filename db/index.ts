import { db } from './client';
import { errorMapper } from './middleware/errorMapper';
import { logger } from './middleware/logger';
import { retry } from './middleware/retry';

import type { SQLiteBindParams } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

let setupPromise: Promise<void> | null = null;
const DEMO_USER = {
    id: 'u_1', email: 'alex@example.com', firstName: 'Alex', lastName: 'Rivera',
    affiliation: 'Fort Greene, Brooklyn',
};
const HOME_FEATURES = [
    ['campus', 'Access Campus', 'Report accessibility issues and vote on changes.', 'View reports', '/reports', 'campus', 'campus'],
    ['access-check', 'AccessCheck', 'Find and review places with community accessibility information.', 'Explore places', '/explore', 'place', 'explore'],
    ['quiet-score', 'QuietScore', 'Share sensory experiences and discover quieter places.', 'Check scores', '/explore', 'quiet', 'quiet'],
] as const;

async function ensureTables() {
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL,
            passwordSalt TEXT NOT NULL DEFAULT '',
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            affiliation TEXT NOT NULL,
            reports INTEGER NOT NULL DEFAULT 0,
            reviews INTEGER NOT NULL DEFAULT 0,
            votes INTEGER NOT NULL DEFAULT 0
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS session (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS features (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            action TEXT NOT NULL,
            route TEXT NOT NULL,
            icon TEXT NOT NULL,
            accent TEXT NOT NULL,
            sortIndex INTEGER NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS polls (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            location TEXT NOT NULL,
            closesAt TEXT NOT NULL,
            hasVoted INTEGER NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS places (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            rating REAL,
            reviewCount INTEGER NOT NULL,
            quietScore INTEGER,
            verified INTEGER NOT NULL,
            latitude REAL NOT NULL DEFAULT 40.7532,
            longitude REAL NOT NULL DEFAULT -73.9822,
            featuresJson TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            accessibilityNote TEXT NOT NULL DEFAULT '',
            sourceLabel TEXT NOT NULL DEFAULT '',
            sourceUrl TEXT NOT NULL DEFAULT '',
            communityGuide TEXT NOT NULL DEFAULT '',
            guideAuthor TEXT NOT NULL DEFAULT '',
            guideUpdatedAt TEXT NOT NULL DEFAULT '',
            sortIndex INTEGER NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS activity (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            subtitle TEXT NOT NULL,
            occurredAt TEXT NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            location TEXT NOT NULL,
            status TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            upvotes INTEGER NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            placeId TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
            userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            quietScore INTEGER,
            accessibilityNotes TEXT NOT NULL,
            createdAt TEXT NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS report_comments (
            id TEXT PRIMARY KEY,
            reportId TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
            userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            createdAt TEXT NOT NULL
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS report_upvotes (
            reportId TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
            userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (reportId, userId)
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            notificationsEnabled INTEGER NOT NULL DEFAULT 1,
            reportUpdatesEnabled INTEGER NOT NULL DEFAULT 1,
            voteRemindersEnabled INTEGER NOT NULL DEFAULT 1,
            campusName TEXT NOT NULL DEFAULT ''
        )
    `);

    await ensureColumn('places', 'latitude', 'REAL NOT NULL DEFAULT 40.7532');
    await ensureColumn('places', 'longitude', 'REAL NOT NULL DEFAULT -73.9822');
    await ensureColumn('places', 'address', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('places', 'accessibilityNote', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('places', 'sourceLabel', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('places', 'sourceUrl', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('places', 'communityGuide', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('places', 'guideAuthor', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('places', 'guideUpdatedAt', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn('users', 'passwordSalt', "TEXT NOT NULL DEFAULT ''");
}

async function ensureColumn(table: string, column: string, definition: string) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!columns.some((item) => item.name === column)) {
        await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

async function seedIfEmpty(countSql: string, insertSql: string, rows: SQLiteBindParams[]) {
    const row = await db.getFirstAsync<{ count: number }>(countSql);
    if ((row?.count ?? 0) > 0) {
        return;
    }

    for (const params of rows) {
        await db.runAsync(insertSql, params);
    }
}

async function seedDatabase() {
    const seeded = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_meta WHERE key = 'seeded'");
    if (!seeded) {
        const passwordHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            'accessall-demo-salt-v1:accessall-demo',
        );
        await db.runAsync(
            'INSERT OR IGNORE INTO users (id, email, passwordHash, passwordSalt, firstName, lastName, affiliation, reports, reviews, votes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [DEMO_USER.id, DEMO_USER.email, passwordHash, 'accessall-demo-salt-v1', DEMO_USER.firstName, DEMO_USER.lastName, DEMO_USER.affiliation, 0, 0, 0],
        );
        await db.runAsync('INSERT OR REPLACE INTO session (singleton, userId) VALUES (1, ?)', [DEMO_USER.id]);
        await db.runAsync("INSERT INTO app_meta (key, value) VALUES ('seeded', '1')");
    }

    await seedIfEmpty(
        'SELECT COUNT(*) AS count FROM features',
        'INSERT INTO features (id, title, description, action, route, icon, accent, sortIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        HOME_FEATURES.map((feature, index) => [...feature, index]),
    );

    await db.runAsync(
        'INSERT OR IGNORE INTO app_settings (singleton, notificationsEnabled, reportUpdatesEnabled, voteRemindersEnabled, campusName) VALUES (1, 1, 1, 1, ?)',
        [DEMO_USER.affiliation],
    );
}

export async function setupDB() {
    if (!setupPromise) {
        setupPromise = (async () => {
            await db.init('app.db');
            await db.runAsync('PRAGMA foreign_keys = ON');
            db.use(logger);
            db.use(retry(3));
            db.use(errorMapper);
            await ensureTables();
            await seedDatabase();
        })();
    }

    return setupPromise;
}

export { db };
