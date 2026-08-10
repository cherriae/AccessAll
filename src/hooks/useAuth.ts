import type { User } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { db } from '../../db';

type SignUpPayload = { email: string; password: string; firstName: string; lastName: string; affiliation?: string };
type SignInPayload = { email: string; password: string };

type UserRow = {
    id: string; email: string; firstName: string; lastName: string;
    affiliation: string; reports: number; reviews: number; votes: number;
};

const hashPassword = (password: string, salt: string) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt ? `${salt}:${password}` : password);

function mapUser(row: UserRow): User {
    return {
        id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName,
        affiliation: row.affiliation,
        stats: { reports: row.reports, reviews: row.reviews, votes: row.votes },
    };
}

export function useSignUp() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (p: SignUpPayload) => {
            const email = p.email.trim().toLowerCase();
            if (!email.includes('@') || p.password.length < 8) throw new Error('INVALID_CREDENTIALS');
            if (await db.getFirstAsync('SELECT id FROM users WHERE email = ? LIMIT 1', [email])) {
                throw new Error('ACCOUNT_EXISTS');
            }
            const user: User = {
                id: `u_${Date.now()}`,
                email,
                firstName: p.firstName,
                lastName: p.lastName,
                affiliation: p.affiliation ?? '',
                stats: { reports: 0, reviews: 0, votes: 0 },
            };
            const passwordSalt = Crypto.randomUUID();
            const passwordHash = await hashPassword(p.password, passwordSalt);
            await db.withTransactionAsync(async () => {
                await db.runAsync(
                    'INSERT INTO users (id, email, passwordHash, passwordSalt, firstName, lastName, affiliation, reports, reviews, votes) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)',
                    [user.id, user.email, passwordHash, passwordSalt, user.firstName, user.lastName, user.affiliation],
                );
                await db.runAsync('INSERT OR REPLACE INTO session (singleton, userId) VALUES (1, ?)', [user.id]);
            });
            qc.setQueryData(['currentUser'], user);
            return user;
        },
    });
}

export function useSignIn() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (p: SignInPayload) => {
            const row = await db.getFirstAsync<UserRow & { passwordHash: string; passwordSalt: string }>(
                'SELECT id, email, passwordHash, passwordSalt, firstName, lastName, affiliation, reports, reviews, votes FROM users WHERE email = ? LIMIT 1',
                [p.email.trim().toLowerCase()],
            );
            if (!row || row.passwordHash !== (await hashPassword(p.password, row.passwordSalt))) throw new Error('INVALID_CREDENTIALS');
            await db.runAsync('INSERT OR REPLACE INTO session (singleton, userId) VALUES (1, ?)', [row.id]);
            const user = mapUser(row);
            qc.setQueryData(['currentUser'], user);
            return user;
        },
    });
}

export function useSignOut() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await db.runAsync('DELETE FROM session');
            qc.setQueryData(['currentUser'], null);
            return null;
        },
    });
}
