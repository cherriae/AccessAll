/**
 * Turns a report into a formal request a student can send to school staff.
 *
 * Most students do not know that a barrier at school is something the school
 * is obliged to address, or how to ask in a way that gets a written answer.
 * The letter states the facts the app already holds — what, where, since when,
 * how many people it affects — cites the laws that apply to US public schools,
 * and asks for a dated response, which is what moves a request forward.
 */

import type { Report } from '@/types';

export interface AdvocacyLetterInput {
  report: Pick<Report, 'title' | 'location' | 'createdAt' | 'upvotes' | 'status'>;
  /** The signed-in student's name; omitted when they are not signed in. */
  senderName?: string;
  senderAffiliation?: string;
  /** Number of comments on the report, as evidence of ongoing impact. */
  commentCount: number;
  /** Public link to the report, when the app is served on the web. */
  reportUrl?: string;
  /** Defaults to now; injectable for tests. */
  today?: Date;
}

export interface AdvocacyLetter {
  subject: string;
  body: string;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function buildAdvocacyLetter({
  report,
  senderName,
  senderAffiliation,
  commentCount,
  reportUrl,
  today = new Date(),
}: AdvocacyLetterInput): AdvocacyLetter {
  const filed = new Date(report.createdAt);
  const days = daysBetween(filed, today);
  const affected = report.upvotes === 1 ? '1 person has' : `${report.upvotes} people have`;
  const reply = new Date(today.getTime() + 10 * 86_400_000);

  const evidence = [
    `- Barrier: ${report.title}`,
    `- Location: ${report.location}`,
    `- First reported: ${formatDate(filed)} (${days} ${days === 1 ? 'day' : 'days'} ago)`,
    `- ${affected} confirmed on AccessAll that this barrier affects them`,
    commentCount > 0 ? `- ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'} from the community describe its impact` : null,
    `- Current status: ${report.status === 'in-progress' ? 'in progress' : report.status}`,
    reportUrl ? `- Full report: ${reportUrl}` : null,
  ].filter(Boolean);

  const signature = [senderName || '[Your name]', senderAffiliation].filter(Boolean).join('\n');

  return {
    subject: `Accessibility barrier: ${report.title} (${report.location})`,
    body: [
      'Dear school administrator,',
      '',
      `I am writing to ask the school to fix an accessibility barrier at ${report.location}: ${report.title.toLowerCase()}.`,
      '',
      'Details, as recorded by students on AccessAll:',
      ...evidence,
      '',
      'Under Section 504 of the Rehabilitation Act and Title II of the Americans with Disabilities Act, ' +
        'schools must make their programs and facilities accessible to students with disabilities. ' +
        'This barrier stops some students from moving through the school safely and independently.',
      '',
      `Could you please let me know in writing by ${formatDate(reply)} what will be done and when? ` +
        'If someone else handles accessibility or Section 504 matters, I would be grateful if you could forward this to them.',
      '',
      'Thank you for your time.',
      '',
      'Sincerely,',
      signature,
    ].join('\n'),
  };
}

/** A `mailto:` link that opens the letter in the user's email app. */
export function advocacyMailto(letter: AdvocacyLetter, recipient = '') {
  return `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`;
}
