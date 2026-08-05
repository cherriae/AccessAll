// hooks/useSchoolReport.ts
import type { Report } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';

export function useSchoolReport() {
  return useQuery({
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
      // ensure table exists
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          location TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          upvotes INTEGER NOT NULL
        )`
      );

      const id = `r_${Date.now()}`;
      const createdAt = new Date().toISOString();
      const params = [id, payload.title, payload.location, 'open', createdAt, 0];
      return db.runAsync(
        'INSERT INTO reports (id, title, location, status, createdAt, upvotes) VALUES (?, ?, ?, ?, ?, ?)',
        params
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useSchoolReportDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.runAsync('DELETE FROM reports WHERE id = ?', [id]);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}