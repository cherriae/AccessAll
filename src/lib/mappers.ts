/**
 * Database rows in, domain models out.
 *
 * The database speaks snake_case and stores `null` for "not known yet"; the UI
 * in `src/types` speaks camelCase and uses `undefined` for optional prose. This
 * is the single place that translation happens, so screens never see a raw row.
 */

import type {
    ActivityEvent,
    AppSettings,
    Feature,
    Place,
    Poll,
    Report,
    ReportComment,
    Review,
    User,
} from '@/types';

import type {
    ActivityRow,
    AppFeatureRow,
    PlaceFeedRow,
    PollFeedRow,
    ProfileStatsRow,
    ReportCommentFeedRow,
    ReportRow,
    ReviewFeedRow,
    UserSettingsRow,
} from './database.types';

/**
 * PostgREST serialises `numeric` columns as JSON numbers, but a client that
 * parses large numerics as strings would otherwise land a string in a `number`
 * field and render "NaN" stars.
 */
function toNumber(value: number | string | null): number | null {
    if (value === null) {
        return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Empty strings are how the schema spells "no prose here"; the UI wants `undefined`. */
function optionalText(value: string | null): string | undefined {
    return value ? value : undefined;
}

export function toPlace(row: PlaceFeedRow): Place {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        rating: toNumber(row.rating),
        reviewCount: row.review_count,
        quietScore: row.quiet_score,
        latitude: row.latitude,
        longitude: row.longitude,
        features: Array.isArray(row.features) ? row.features : [],
        address: optionalText(row.address),
        accessibilityNote: optionalText(row.accessibility_note),
        sourceLabel: optionalText(row.source_label),
        sourceUrl: optionalText(row.source_url),
        communityGuide: optionalText(row.community_guide),
        guideAuthor: optionalText(row.guide_author),
        guideUpdatedAt: optionalText(row.guide_updated_at),
    };
}

export function toReview(row: ReviewFeedRow): Review {
    return {
        id: row.id,
        placeId: row.place_id,
        authorName: row.author_name,
        rating: row.rating,
        quietScore: row.quiet_score,
        accessibilityNotes: row.accessibility_notes,
        createdAt: row.created_at,
    };
}

export function toReport(row: ReportRow): Report {
    return {
        id: row.id,
        title: row.title,
        location: row.location,
        status: row.status,
        createdAt: row.created_at,
        upvotes: row.upvotes,
        createdBy: row.created_by,
    };
}

export function toReportComment(row: ReportCommentFeedRow): ReportComment {
    return {
        id: row.id,
        reportId: row.report_id,
        authorName: row.author_name,
        body: row.body,
        createdAt: row.created_at,
    };
}

export function toPoll(row: PollFeedRow): Poll {
    return {
        id: row.id,
        title: row.title,
        location: row.location,
        closesAt: row.closes_at,
        hasVoted: row.has_voted,
    };
}

export function toActivityEvent(row: ActivityRow): ActivityEvent {
    return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        subtitle: row.subtitle,
        occurredAt: row.occurred_at,
    };
}

export function toUser(row: ProfileStatsRow): User {
    return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        affiliation: row.affiliation,
        stats: {
            reports: row.report_count,
            reviews: row.review_count,
            votes: row.vote_count,
        },
    };
}

export function toAppSettings(row: UserSettingsRow | null): AppSettings {
    return {
        notificationsEnabled: row?.notifications_enabled ?? true,
        reportUpdatesEnabled: row?.report_updates_enabled ?? true,
        voteRemindersEnabled: row?.vote_reminders_enabled ?? true,
        campusName: row?.campus_name ?? '',
    };
}

export function toFeature(row: AppFeatureRow): Feature {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        action: row.action,
        route: row.route as Feature['route'],
        icon: row.icon as Feature['icon'],
        accent: row.accent as Feature['accent'],
    };
}
