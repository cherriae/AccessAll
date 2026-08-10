import type { Report } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

export function useSchoolReport() {
  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: () =>
      db.getAllAsync<Report>(
        'SELECT id, title, location, status, createdAt, upvotes FROM reports ORDER BY createdAt DESC'
      ),
  });
}

export function useSchoolReportAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; location: string }) => {
      const id = `r_${Date.now()}`;
      const createdAt = new Date().toISOString();
      const params = [id, payload.title, payload.location, 'open', createdAt, 0];
      await db.runAsync(
        'INSERT INTO reports (id, title, location, status, createdAt, upvotes) VALUES (?, ?, ?, ?, ?, ?)',
        params
      );

      const currentUser = await db.getFirstAsync<{ id: string }>('SELECT id FROM current_user LIMIT 1');
      if (currentUser) {
        await db.runAsync('UPDATE current_user SET reports = reports + 1 WHERE id = ?', [currentUser.id]);
      }

      await db.runAsync(
        'INSERT INTO activity (id, kind, title, subtitle, occurredAt) VALUES (?, ?, ?, ?, ?)',
        [id.replace(/^r_/, 'a_'), 'report', `You reported ${payload.title}`, payload.location, createdAt]
      );

      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      return id;
    },
  });
}

export function useSchoolReportDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.runAsync('DELETE FROM reports WHERE id = ?', [id]);
      qc.invalidateQueries({ queryKey: ['reports'] });
      return id;
    },
  });
}

export function useSchoolReportUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      location: string;
      status: Report['status'];
    }) => {
      await db.runAsync(
        'UPDATE reports SET title = ?, location = ?, status = ? WHERE id = ?',
        [payload.title, payload.location, payload.status, payload.id],
      );
      qc.invalidateQueries({ queryKey: ['reports'] });
      return payload.id;
    },
  });
}