import type { Report, ReportComment } from '@/types';
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

export function useReport(id?: string) {
  return useQuery<Report | null>({
    queryKey: ['report', id],
    enabled: Boolean(id),
    queryFn: () => db.getFirstAsync<Report>(
      'SELECT id, title, location, status, createdAt, upvotes FROM reports WHERE id = ? LIMIT 1',
      [id!],
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
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'INSERT INTO reports (id, title, location, status, createdAt, upvotes) VALUES (?, ?, ?, ?, ?, ?)',
          params,
        );
        await db.runAsync('UPDATE users SET reports = reports + 1 WHERE id = (SELECT userId FROM session WHERE singleton = 1)');
        await db.runAsync(
          'INSERT INTO activity (id, kind, title, subtitle, occurredAt) VALUES (?, ?, ?, ?, ?)',
          [id.replace(/^r_/, 'a_'), 'report', `You reported ${payload.title}`, payload.location, createdAt],
        );
      });

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
      qc.invalidateQueries({ queryKey: ['report', payload.id] });
      return payload.id;
    },
  });
}

export function useReportComments(reportId?: string) {
  return useQuery<ReportComment[]>({
    queryKey: ['reportComments', reportId],
    enabled: Boolean(reportId),
    queryFn: () => db.getAllAsync<ReportComment>(
      `SELECT c.id, c.reportId, (u.firstName || ' ' || u.lastName) AS authorName, c.body, c.createdAt
       FROM report_comments c JOIN users u ON u.id = c.userId
       WHERE c.reportId = ? ORDER BY c.createdAt ASC`,
      [reportId!],
    ),
  });
}

export function useAddReportComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, body }: { reportId: string; body: string }) => {
      const session = await db.getFirstAsync<{ userId: string }>('SELECT userId FROM session WHERE singleton = 1');
      if (!session) throw new Error('SIGN_IN_REQUIRED');
      await db.runAsync(
        'INSERT INTO report_comments (id, reportId, userId, body, createdAt) VALUES (?, ?, ?, ?, ?)',
        [`rc_${Date.now()}`, reportId, session.userId, body.trim(), new Date().toISOString()],
      );
      await qc.invalidateQueries({ queryKey: ['reportComments', reportId] });
    },
  });
}

export function useToggleReportUpvote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const session = await db.getFirstAsync<{ userId: string }>('SELECT userId FROM session WHERE singleton = 1');
      if (!session) throw new Error('SIGN_IN_REQUIRED');
      const existing = await db.getFirstAsync(
        'SELECT reportId FROM report_upvotes WHERE reportId = ? AND userId = ?',
        [reportId, session.userId],
      );
      await db.withTransactionAsync(async () => {
        if (existing) {
          await db.runAsync('DELETE FROM report_upvotes WHERE reportId = ? AND userId = ?', [reportId, session.userId]);
          await db.runAsync('UPDATE reports SET upvotes = MAX(0, upvotes - 1) WHERE id = ?', [reportId]);
        } else {
          await db.runAsync('INSERT INTO report_upvotes (reportId, userId) VALUES (?, ?)', [reportId, session.userId]);
          await db.runAsync('UPDATE reports SET upvotes = upvotes + 1 WHERE id = ?', [reportId]);
        }
      });
      await qc.invalidateQueries({ queryKey: ['reports'] });
      await qc.invalidateQueries({ queryKey: ['report', reportId] });
      return !existing;
    },
  });
}
