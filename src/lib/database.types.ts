/**
 * Hand-maintained shape of the AccessAll Postgres schema.
 *
 * Mirrors `supabase/migrations` (0001 through 0011). Keeping it here (rather than
 * running `supabase gen types`) means the repo type-checks without the Supabase
 * CLI installed — but it also means this file has to be edited whenever the
 * migration changes. Columns the database computes for you (generated columns
 * and trigger-maintained aggregates) are omitted from `Insert`/`Update`, so a
 * mistaken write to them fails at compile time rather than silently at runtime.
 */

import type { AccessFeature } from '@/types';

/** Columns that must be supplied on insert; everything else has a default. */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> &
    Partial<Omit<Row, Required>>;

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
    Row: Row;
    Insert: Insert;
    Update: Update;
    Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

/** `email` exists on the table but is not readable by clients (0006). */
export type ProfileRow = {
    id: string;
    first_name: string;
    last_name: string;
    affiliation: string;
    /** Generated: `first_name || ' ' || last_name`. Readable only through `profile_stats`. */
    display_name: string;
    /** Generated: "First L.", the only name other people see (0010). */
    public_name: string;
    created_at: string;
};

export type UserSettingsRow = {
    user_id: string;
    notifications_enabled: boolean;
    report_updates_enabled: boolean;
    vote_reminders_enabled: boolean;
    campus_name: string;
    /** When the user last opened their activity feed; anything newer is unread. */
    activity_seen_at: string;
    access_needs: string[];
    /** MTA station complex ids watched by Detour Radar. */
    watched_stations: string[];
};

export type PlaceRow = {
    id: string;
    name: string;
    category: string;
    address: string;
    accessibility_note: string;
    source_label: string;
    source_url: string;
    community_guide: string;
    guide_author_id: string | null;
    guide_updated_at: string | null;
    latitude: number;
    longitude: number;
    features: AccessFeature[];
    /** Trigger-maintained from `reviews`. */
    rating: number | null;
    review_count: number;
    quiet_score: number | null;
    created_by: string | null;
    created_at: string;
};

/**
 * `location` is a generated geography column, `rating`/`review_count`/`quiet_score` are
 * trigger-owned, and the guide author and timestamp are stamped by a trigger.
 */
type PlaceWritable = Omit<
    PlaceRow,
    'id' | 'rating' | 'review_count' | 'quiet_score' | 'created_at' | 'guide_author_id' | 'guide_updated_at'
>;

export type ReviewRow = {
    id: string;
    place_id: string;
    user_id: string;
    rating: number;
    quiet_score: number | null;
    accessibility_notes: string;
    created_at: string;
    updated_at: string;
    /** The quiet score came from the phone microphone, not an impression. */
    quiet_measured: boolean;
};

/** `location_point` is a generated geography column, so it is not listed here. */
export type ReportRow = {
    id: string;
    title: string;
    location: string;
    /** Null on rows filed before the location picker; see `Report` in `@/types`. */
    latitude: number | null;
    longitude: number | null;
    status: 'open' | 'in-progress' | 'resolved';
    created_by: string | null;
    created_at: string;
    /** Trigger-maintained from `report_upvotes`. */
    upvotes: number;
    /** Trigger-maintained from `status`. */
    resolved_at: string | null;
    /** Latest update from school staff, written only by `staff_update_report`. */
    staff_note: string;
    staff_photo_path: string;
    staff_updated_by: string | null;
    staff_updated_at: string | null;
};

export type ReportCommentRow = {
    id: string;
    report_id: string;
    user_id: string;
    body: string;
    created_at: string;
};

export type ReportUpvoteRow = {
    report_id: string;
    user_id: string;
    created_at: string;
};

/** `location_point` is a generated geography column, so it is not listed here. */
export type PollRow = {
    id: string;
    title: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    closes_at: string;
    created_by: string | null;
    created_at: string;
    /** Trigger-maintained from `poll_votes`. */
    vote_count: number;
};

export type PollVoteRow = {
    poll_id: string;
    user_id: string;
    created_at: string;
};

export type ActivityRow = {
    id: string;
    user_id: string;
    kind: 'report' | 'review' | 'vote' | 'comment' | 'status';
    title: string;
    subtitle: string;
    occurred_at: string;
    /** Set when the entry is about a report, so the feed can open it. */
    report_id: string | null;
};

export type AppFeatureRow = {
    id: string;
    title: string;
    description: string;
    action: string;
    route: string;
    icon: string;
    accent: string;
    sort_index: number;
};

export type ProfileStatsRow = {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string;
    affiliation: string;
    report_count: number;
    review_count: number;
    vote_count: number;
};

export type PollFeedRow = {
    id: string;
    title: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    closes_at: string;
    vote_count: number;
    has_voted: boolean;
};

/** `places` with the guide author's name already resolved. */
export type PlaceFeedRow = Omit<PlaceRow, 'guide_author_id' | 'created_by'> & {
    guide_author: string;
};

export type ReviewFeedRow = ReviewRow & { author_name: string };

export type DirectionStepJson = { text: string; photo?: string };

export type PlaceDirectionRow = {
    id: string;
    place_id: string;
    user_id: string;
    title: string;
    steps: DirectionStepJson[];
    created_at: string;
    updated_at: string;
};

export type DirectionFeedRow = Pick<PlaceDirectionRow, 'id' | 'place_id' | 'user_id' | 'title' | 'steps' | 'updated_at'> & {
    author_name: string;
};

export type ContentTargetType = 'report' | 'comment' | 'review' | 'direction';
export type ContentReportReason = 'harassment' | 'spam' | 'false-info' | 'inappropriate' | 'other';

export type ContentReportRow = {
    id: string;
    reporter_id: string;
    target_type: ContentTargetType;
    target_id: string;
    reason: ContentReportReason;
    details: string;
    status: 'open' | 'actioned' | 'dismissed';
    created_at: string;
};

export type UserBlockRow = { blocker_id: string; blocked_id: string; created_at: string };

export type ModerationQueueRow = {
    target_type: ContentTargetType;
    target_id: string;
    report_count: number;
    reasons: ContentReportReason[];
    first_reported_at: string;
    content: string;
    is_hidden: boolean;
};

export type PlaceEditFeedRow = {
    id: string;
    place_id: string;
    old_features: AccessFeature[];
    new_features: AccessFeature[];
    old_guide: string;
    new_guide: string;
    created_at: string;
    reverted_at: string | null;
    editor_name: string;
};

export type MyBlockRow = { blocked_id: string; created_at: string; blocked_name: string };

export type RampMeasurementRow = {
    place_id: string;
    user_id: string;
    /** `numeric`, so it may arrive as a string. */
    slope_percent: number | string;
    created_at: string;
};

export type StaffMemberRow = { user_id: string; title: string; added_at: string };

export type ImpactSummaryRow = {
    reports_total: number;
    reports_resolved: number;
    reports_in_progress: number;
    people_affected: number;
    /** `numeric`, so it may arrive as a string. Null until something is resolved. */
    median_days_to_resolve: number | string | null;
    places_reviewed: number;
    reviews_total: number;
    sound_measurements: number;
    contributors: number;
    ramps_measured: number;
};

export type ReportCommentFeedRow = ReportCommentRow & { author_name: string };

export type Database = {
    public: {
        Tables: {
            profiles: Table<
                ProfileRow,
                never,
                Partial<Pick<ProfileRow, 'first_name' | 'last_name' | 'affiliation'>>
            >;
            user_settings: Table<
                UserSettingsRow,
                Insertable<UserSettingsRow, 'user_id'>,
                Partial<Omit<UserSettingsRow, 'user_id'>>
            >;
            places: Table<
                PlaceRow,
                Insertable<PlaceWritable, 'name' | 'latitude' | 'longitude' | 'created_by'>,
                Partial<Pick<PlaceRow, 'community_guide' | 'features'>>
            >;
            reviews: Table<
                ReviewRow,
                Insertable<Omit<ReviewRow, 'id' | 'created_at' | 'updated_at'>, 'place_id' | 'user_id' | 'rating'>,
                Partial<Pick<ReviewRow, 'place_id' | 'user_id' | 'rating' | 'quiet_score' | 'accessibility_notes' | 'quiet_measured'>>
            >;
            reports: Table<
                ReportRow,
                Insertable<Pick<ReportRow, 'title' | 'location' | 'latitude' | 'longitude' | 'created_by'>, 'title' | 'created_by'>,
                Partial<Pick<ReportRow, 'title' | 'location' | 'latitude' | 'longitude' | 'status'>>
            >;
            report_comments: Table<
                ReportCommentRow,
                Insertable<Omit<ReportCommentRow, 'id' | 'created_at'>, 'report_id' | 'user_id' | 'body'>,
                never
            >;
            report_upvotes: Table<
                ReportUpvoteRow,
                Insertable<ReportUpvoteRow, 'report_id' | 'user_id'>,
                never
            >;
            polls: Table<
                PollRow,
                Insertable<Omit<PollRow, 'id' | 'created_at' | 'vote_count'>, 'title' | 'closes_at' | 'created_by'>,
                never
            >;
            poll_votes: Table<
                PollVoteRow,
                Insertable<PollVoteRow, 'poll_id' | 'user_id'>,
                never
            >;
            place_directions: Table<
                PlaceDirectionRow,
                Insertable<Pick<PlaceDirectionRow, 'place_id' | 'user_id' | 'title' | 'steps'>, 'place_id' | 'user_id' | 'title' | 'steps'>,
                Partial<Pick<PlaceDirectionRow, 'title' | 'steps'>>
            >;
            staff_members: Table<StaffMemberRow, never, never>;
            ramp_measurements: Table<
                RampMeasurementRow,
                Insertable<Pick<RampMeasurementRow, 'place_id' | 'user_id' | 'slope_percent'>, 'place_id' | 'user_id' | 'slope_percent'>,
                Partial<Pick<RampMeasurementRow, 'slope_percent' | 'created_at'>>
            >;
            content_reports: Table<
                ContentReportRow,
                Insertable<Pick<ContentReportRow, 'reporter_id' | 'target_type' | 'target_id' | 'reason' | 'details'>, 'reporter_id' | 'target_type' | 'target_id' | 'reason'>,
                never
            >;
            user_blocks: Table<UserBlockRow, Pick<UserBlockRow, 'blocker_id' | 'blocked_id'>, never>;
            activity: Table<ActivityRow, never, never>;
            app_features: Table<AppFeatureRow, never, never>;
        };
        Views: {
            profile_stats: View<ProfileStatsRow>;
            poll_feed: View<PollFeedRow>;
            place_feed: View<PlaceFeedRow>;
            review_feed: View<ReviewFeedRow>;
            report_comment_feed: View<ReportCommentFeedRow>;
            direction_feed: View<DirectionFeedRow>;
            impact_summary: View<ImpactSummaryRow>;
            moderation_queue: View<ModerationQueueRow>;
            place_edit_feed: View<PlaceEditFeedRow>;
            my_blocks: View<MyBlockRow>;
        };
        Functions: {
            moderate_content: {
                Args: { kind: ContentTargetType; target: string; decision: 'hide' | 'dismiss' };
                Returns: undefined;
            };
            revert_place_edit: {
                Args: { edit_id: string };
                Returns: undefined;
            };
            mark_activity_seen: {
                Args: Record<string, never>;
                Returns: undefined;
            };
            is_staff: {
                Args: { uid?: string };
                Returns: boolean;
            };
            staff_update_report: {
                Args: { report_id: string; new_status: string; note?: string; photo_path?: string };
                Returns: undefined;
            };
            delete_my_account: {
                Args: Record<string, never>;
                Returns: undefined;
            };
            places_in_bounds: {
                Args: { min_lat: number; min_lng: number; max_lat: number; max_lng: number };
                Returns: PlaceFeedRow[];
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};
