/**
 * Hand-maintained shape of the AccessAll Postgres schema.
 *
 * Mirrors `supabase/migrations/0001_init.sql`. Keeping it here (rather than
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

export type ProfileRow = {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    affiliation: string;
    /** Generated: `first_name || ' ' || last_name`. */
    display_name: string;
    created_at: string;
};

export type UserSettingsRow = {
    user_id: string;
    notifications_enabled: boolean;
    report_updates_enabled: boolean;
    vote_reminders_enabled: boolean;
    campus_name: string;
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

/** `location` is a generated geography column and `rating`/`review_count`/`quiet_score` are trigger-owned. */
type PlaceWritable = Omit<PlaceRow, 'id' | 'rating' | 'review_count' | 'quiet_score' | 'created_at'>;

export type ReviewRow = {
    id: string;
    place_id: string;
    user_id: string;
    rating: number;
    quiet_score: number | null;
    accessibility_notes: string;
    created_at: string;
    updated_at: string;
};

export type ReportRow = {
    id: string;
    title: string;
    location: string;
    status: 'open' | 'in-progress' | 'resolved';
    created_by: string | null;
    created_at: string;
    /** Trigger-maintained from `report_upvotes`. */
    upvotes: number;
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

export type PollRow = {
    id: string;
    title: string;
    location: string;
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
    kind: 'report' | 'review' | 'vote';
    title: string;
    subtitle: string;
    occurred_at: string;
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
    email: string;
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
    closes_at: string;
    vote_count: number;
    has_voted: boolean;
};

/** `places` with the guide author's name already resolved. */
export type PlaceFeedRow = Omit<PlaceRow, 'guide_author_id' | 'created_by'> & {
    guide_author: string;
};

export type ReviewFeedRow = ReviewRow & { author_name: string };

export type ReportCommentFeedRow = ReportCommentRow & { author_name: string };

export type Database = {
    public: {
        Tables: {
            profiles: Table<
                ProfileRow,
                Insertable<Omit<ProfileRow, 'display_name'>, 'id' | 'email'>,
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
                Partial<PlaceWritable>
            >;
            reviews: Table<
                ReviewRow,
                Insertable<Omit<ReviewRow, 'id' | 'created_at'>, 'place_id' | 'user_id' | 'rating'>,
                Partial<Pick<ReviewRow, 'rating' | 'quiet_score' | 'accessibility_notes' | 'updated_at'>>
            >;
            reports: Table<
                ReportRow,
                Insertable<Omit<ReportRow, 'id' | 'created_at' | 'upvotes'>, 'title' | 'created_by'>,
                Partial<Pick<ReportRow, 'title' | 'location' | 'status'>>
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
            activity: Table<ActivityRow, never, never>;
            app_features: Table<AppFeatureRow, never, never>;
        };
        Views: {
            profile_stats: View<ProfileStatsRow>;
            poll_feed: View<PollFeedRow>;
            place_feed: View<PlaceFeedRow>;
            review_feed: View<ReviewFeedRow>;
            report_comment_feed: View<ReportCommentFeedRow>;
        };
        Functions: {
            places_nearby: {
                Args: { lat: number; lng: number; radius_meters?: number };
                Returns: PlaceFeedRow[];
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
