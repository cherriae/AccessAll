/**
 * Database rows in, domain models out.
 *
 * The database speaks snake_case and stores `null` for "not known yet"; the UI
 * in `src/types` speaks camelCase and uses `undefined` for optional prose. This
 * is the single place that translation happens, so screens never see a raw row.
 */

import { ACCESS_NEEDS } from '@/types';
import type {
    AccessFeature,
    AccessNeed,
    BlockedUser,
    ModerationItem,
    PlaceEdit,
    ImpactSummary,
    PlaceDirection,
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
    DirectionFeedRow,
    ModerationQueueRow,
    MyBlockRow,
    PlaceEditFeedRow,
    ImpactSummaryRow,
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
export function toNumber(value: number | string | null): number | null {
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

/**
 * `features` is community-written jsonb. 0006 constrains its shape for new
 * writes, but older rows predate that, and one entry without a `label` would
 * otherwise throw inside every list that renders it.
 */
function toFeatures(value: unknown): AccessFeature[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (item): item is AccessFeature =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.id === 'string' &&
            typeof item.label === 'string' &&
            typeof item.icon === 'string',
    );
}

/** Only web links open from a source button; anything else is dropped. */
function toWebUrl(value: string | null): string | undefined {
    return value && /^https?:\/\//i.test(value) ? value : undefined;
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
        features: toFeatures(row.features),
        address: optionalText(row.address),
        accessibilityNote: optionalText(row.accessibility_note),
        sourceLabel: optionalText(row.source_label),
        sourceUrl: toWebUrl(row.source_url),
        communityGuide: optionalText(row.community_guide),
        guideAuthor: optionalText(row.guide_author),
        guideUpdatedAt: optionalText(row.guide_updated_at),
    };
}

export function toReview(row: ReviewFeedRow): Review {
    return {
        id: row.id,
        placeId: row.place_id,
        userId: row.user_id,
        authorName: row.author_name,
        rating: row.rating,
        quietScore: row.quiet_score,
        accessibilityNotes: row.accessibility_notes,
        createdAt: row.created_at,
        quietMeasured: row.quiet_measured,
    };
}

export function toReport(row: ReportRow): Report {
    return {
        id: row.id,
        title: row.title,
        location: row.location,
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
        status: row.status,
        createdAt: row.created_at,
        upvotes: row.upvotes,
        createdBy: row.created_by,
        resolvedAt: row.resolved_at,
        staffUpdate: row.staff_updated_at
            ? {
                  note: row.staff_note,
                  photoPath: optionalText(row.staff_photo_path),
                  updatedAt: row.staff_updated_at,
              }
            : null,
    };
}

export function toReportComment(row: ReportCommentFeedRow): ReportComment {
    return {
        id: row.id,
        reportId: row.report_id,
        userId: row.user_id,
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
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
        closesAt: row.closes_at,
        voteCount: row.vote_count,
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
        reportId: row.report_id,
    };
}

export function toUser(row: ProfileStatsRow): User {
    return {
        id: row.id,
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
        activitySeenAt: row?.activity_seen_at ?? null,
        // Unknown values (from a newer client) are dropped rather than trusted.
        accessNeeds: (row?.access_needs ?? []).filter((need): need is AccessNeed =>
            (ACCESS_NEEDS as readonly string[]).includes(need),
        ),
        watchedStations: row?.watched_stations ?? [],
    };
}

export function toPlaceDirection(row: DirectionFeedRow): PlaceDirection {
    return {
        id: row.id,
        placeId: row.place_id,
        userId: row.user_id,
        title: row.title,
        steps: (Array.isArray(row.steps) ? row.steps : [])
            .filter((step) => typeof step?.text === 'string')
            .map((step) => ({ text: step.text, photoPath: optionalText(step.photo ?? null) })),
        authorName: row.author_name,
        updatedAt: row.updated_at,
    };
}

export function toImpactSummary(row: ImpactSummaryRow): ImpactSummary {
    return {
        reportsTotal: row.reports_total,
        reportsResolved: row.reports_resolved,
        reportsInProgress: row.reports_in_progress,
        peopleAffected: row.people_affected,
        medianDaysToResolve: toNumber(row.median_days_to_resolve),
        placesReviewed: row.places_reviewed,
        reviewsTotal: row.reviews_total,
        soundMeasurements: row.sound_measurements,
        contributors: row.contributors,
        rampsMeasured: row.ramps_measured ?? 0,
    };
}

export function toModerationItem(row: ModerationQueueRow): ModerationItem {
    return {
        targetType: row.target_type,
        targetId: row.target_id,
        reportCount: row.report_count,
        reasons: row.reasons ?? [],
        firstReportedAt: row.first_reported_at,
        content: row.content,
        isHidden: row.is_hidden,
    };
}

export function toBlockedUser(row: MyBlockRow): BlockedUser {
    return { userId: row.blocked_id, name: row.blocked_name, blockedAt: row.created_at };
}

/** Summarises an edit as the feature labels it added and removed. */
export function toPlaceEdit(row: PlaceEditFeedRow): PlaceEdit {
    const before = toFeatures(row.old_features);
    const after = toFeatures(row.new_features);
    const beforeIds = new Set(before.map((feature) => feature.id));
    const afterIds = new Set(after.map((feature) => feature.id));

    return {
        id: row.id,
        placeId: row.place_id,
        editorName: row.editor_name,
        added: after.filter((feature) => !beforeIds.has(feature.id)).map((feature) => feature.label),
        removed: before.filter((feature) => !afterIds.has(feature.id)).map((feature) => feature.label),
        guideChanged: row.old_guide !== row.new_guide,
        createdAt: row.created_at,
        revertedAt: row.reverted_at,
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
