import { db } from './client';
import { errorMapper } from './middleware/errorMapper';
import { logger } from './middleware/logger';
import { retry } from './middleware/retry';

import {
    activity as seededActivity,
    currentUser as seededCurrentUser,
    features as seededFeatures,
    places as seededPlaces,
    polls as seededPolls,
    reports as seededReports,
} from '@/data/mock';
import type { SQLiteBindParams } from 'expo-sqlite';

let setupPromise: Promise<void> | null = null;

async function ensureTables() {
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS current_user (
            id TEXT PRIMARY KEY,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            affiliation TEXT NOT NULL,
            reports INTEGER NOT NULL,
            reviews INTEGER NOT NULL,
            votes INTEGER NOT NULL
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
            featuresJson TEXT NOT NULL,
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
}

async function seedIfEmpty(table: string, countSql: string, insertSql: string, rows: SQLiteBindParams[]) {
    const row = await db.getFirstAsync<{ count: number }>(countSql);
    if ((row?.count ?? 0) > 0) {
        return;
    }

    for (const params of rows) {
        await db.runAsync(insertSql, params);
    }
}

async function seedDatabase() {
    await seedIfEmpty(
        'current_user',
        'SELECT COUNT(*) AS count FROM current_user',
        'INSERT INTO current_user (id, firstName, lastName, affiliation, reports, reviews, votes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            [
                seededCurrentUser.id,
                seededCurrentUser.firstName,
                seededCurrentUser.lastName,
                seededCurrentUser.affiliation,
                seededCurrentUser.stats.reports,
                seededCurrentUser.stats.reviews,
                seededCurrentUser.stats.votes,
            ],
        ],
    );

    await seedIfEmpty(
        'features',
        'SELECT COUNT(*) AS count FROM features',
        'INSERT INTO features (id, title, description, action, route, icon, accent, sortIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        seededFeatures.map((feature, index) => [
            feature.id,
            feature.title,
            feature.description,
            feature.action,
            feature.route,
            feature.icon,
            feature.accent,
            index,
        ]),
    );

    await seedIfEmpty(
        'polls',
        'SELECT COUNT(*) AS count FROM polls',
        'INSERT INTO polls (id, title, location, closesAt, hasVoted) VALUES (?, ?, ?, ?, ?)',
        seededPolls.map((poll) => [poll.id, poll.title, poll.location, poll.closesAt, poll.hasVoted ? 1 : 0]),
    );

    await seedIfEmpty(
        'places',
        'SELECT COUNT(*) AS count FROM places',
        'INSERT INTO places (id, name, category, rating, reviewCount, quietScore, verified, featuresJson, sortIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        seededPlaces.map((place, index) => [
            place.id,
            place.name,
            place.category,
            place.rating,
            place.reviewCount,
            place.quietScore,
            place.verified ? 1 : 0,
            JSON.stringify(place.features),
            index,
        ]),
    );

    await seedIfEmpty(
        'activity',
        'SELECT COUNT(*) AS count FROM activity',
        'INSERT INTO activity (id, kind, title, subtitle, occurredAt) VALUES (?, ?, ?, ?, ?)',
        seededActivity.map((event) => [event.id, event.kind, event.title, event.subtitle, event.occurredAt]),
    );

    await seedIfEmpty(
        'reports',
        'SELECT COUNT(*) AS count FROM reports',
        'INSERT INTO reports (id, title, location, status, createdAt, upvotes) VALUES (?, ?, ?, ?, ?, ?)',
        seededReports.map((report) => [report.id, report.title, report.location, report.status, report.createdAt, report.upvotes]),
    );
}

export async function setupDB() {
    if (!setupPromise) {
        setupPromise = (async () => {
            await db.init('app.db');
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

