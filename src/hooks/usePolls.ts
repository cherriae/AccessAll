import type { Poll } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

type PollRow = {
    id: string;
    title: string;
    location: string;
    closesAt: string;
    hasVoted: number;
};

export function usePolls() {
    return useQuery<Poll[]>({
        queryKey: ['polls'],
        queryFn: async () => {
            const rows = await db.getAllAsync<PollRow>(
                'SELECT id, title, location, closesAt, hasVoted FROM polls ORDER BY closesAt ASC',
            );

            return rows.map((row) => ({
                id: row.id,
                title: row.title,
                location: row.location,
                closesAt: row.closesAt,
                hasVoted: row.hasVoted === 1,
            }));
        },
    });
}

export function useVotePoll() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const poll = await db.getFirstAsync<PollRow>(
                'SELECT id, title, location, closesAt, hasVoted FROM polls WHERE id = ? LIMIT 1',
                [id],
            );

            if (!poll || poll.hasVoted) {
                return null;
            }

            await db.runAsync('UPDATE polls SET hasVoted = 1 WHERE id = ?', [id]);
            await db.runAsync('UPDATE current_user SET votes = votes + 1');
            await db.runAsync(
                'INSERT INTO activity (id, kind, title, subtitle, occurredAt) VALUES (?, ?, ?, ?, ?)',
                [
                    `a_${Date.now()}`,
                    'vote',
                    `You voted on ${poll.title}`,
                    poll.location,
                    new Date().toISOString(),
                ],
            );

            qc.invalidateQueries({ queryKey: ['polls'] });
            qc.invalidateQueries({ queryKey: ['currentUser'] });
            qc.invalidateQueries({ queryKey: ['activity'] });
            return id;
        },
    });
}

export function useAddPoll() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Omit<Poll, 'id' | 'hasVoted'>) => {
            const newItem: Poll = { id: `p_${Date.now()}`, hasVoted: false, ...payload } as Poll;
            await db.runAsync(
                'INSERT INTO polls (id, title, location, closesAt, hasVoted) VALUES (?, ?, ?, ?, ?)',
                [newItem.id, newItem.title, newItem.location, newItem.closesAt, 0],
            );
            qc.invalidateQueries({ queryKey: ['polls'] });
            return newItem;
        },
    });
}

export function useDeletePoll() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await db.runAsync('DELETE FROM polls WHERE id = ?', [id]);
            qc.invalidateQueries({ queryKey: ['polls'] });
            return id;
        },
    });
}
