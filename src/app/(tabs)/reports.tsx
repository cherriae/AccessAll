import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { LocationPicker } from "@/components/location-picker";
import { ReportRow } from "@/components/report-row";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Heading, Text } from "@/components/ui/text";
import { VoteCallout } from "@/components/vote-callout";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAddPoll, usePolls, useVotePoll } from "@/hooks/usePolls";
import { useSchoolReport, useSchoolReportAdd } from "@/hooks/useSchoolReport";
import { REPORT_STATUS_DISPLAY } from "@/lib/display";
import type { LocationSelection, ReportStatus } from "@/types";
import { REPORT_STATUSES } from "@/types";

type Filter = "all" | ReportStatus;

/** How long a newly proposed vote stays open. */
const VOTE_WINDOW_DAYS = 14;

const FILTERS: ChipOption<Filter>[] = [
  { value: "all", label: "All" },
  ...REPORT_STATUSES.map((status) => ({
    value: status,
    label: REPORT_STATUS_DISPLAY[status].label,
  })),
];

interface ComposerProps {
  visible: boolean;
  title: string;
  description: string;
  submitLabel: string;
  submitting: boolean;
  /** Why the last attempt to submit failed, shown in the sheet. */
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The sheet both composers are built from.
 *
 * It scrolls because the location picker grows by up to five suggestion rows
 * once someone starts typing, and a fixed-height card would push the save
 * button off the bottom of the screen exactly when it is needed.
 */
function Composer({
  visible,
  title,
  description,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onClose,
  children,
}: ComposerProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Heading variant="title">{title}</Heading>
            <Text variant="body" color="textSecondary">
              {description}
            </Text>

            <View style={styles.form}>{children}</View>

            {/*
              Rendered in the sheet rather than raised as a native alert:
              `Alert.alert` is an empty function on react-native-web, so on the
              web build every validation message was discarded silently and the
              save button simply appeared to do nothing.
            */}
            {error ? (
              <View
                style={[
                  styles.error,
                  { borderColor: theme.danger, backgroundColor: theme.backgroundElement },
                ]}
                accessibilityLiveRegion="polite"
              >
                <Text variant="callout" color="danger">
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.secondaryAction}
              >
                <Text variant="label">Cancel</Text>
              </Pressable>
              <Button label={submitLabel} onPress={onSubmit} disabled={submitting} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportsQuery = useSchoolReport();
  const addReport = useSchoolReportAdd();
  const pollsQuery = usePolls();
  const votePoll = useVotePoll();
  const addPoll = useAddPoll();
  const [voteComposerOpen, setVoteComposerOpen] = useState(false);
  const [voteTitle, setVoteTitle] = useState("");
  const [voteLocation, setVoteLocation] = useState<LocationSelection | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const visible =
    filter === "all"
      ? (reportsQuery.data ?? [])
      : (reportsQuery.data ?? []).filter((r) => r.status === filter);
  const openVotes = (pollsQuery.data ?? []).filter((poll) => !poll.hasVoted);

  function openCreateComposer() {
    setTitle("");
    setLocation(null);
    setReportError(null);
    setComposerOpen(true);
  }

  function openVoteComposer() {
    setVoteTitle("");
    setVoteLocation(null);
    setVoteError(null);
    setVoteComposerOpen(true);
  }

  async function submitReport() {
    if (!title.trim()) {
      setReportError("Add a title so people know what barrier to look for.");
      return;
    }

    if (!location) {
      setReportError(
        "Search for the place and pick it from the list. Confirming the location is what lets this report appear on the map alongside other reports about the same place.",
      );
      return;
    }

    setReportError(null);

    try {
      await addReport.mutateAsync({ title: title.trim(), location });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setReportError(
        code === "AUTH_REQUIRED"
          ? "Sign in to file a report."
          : "Could not save this report. Please try again.",
      );
      return;
    }

    setTitle("");
    setLocation(null);
    setComposerOpen(false);
  }

  async function submitPoll() {
    if (!voteTitle.trim()) {
      setVoteError("Add a title saying what you are asking the community to decide.");
      return;
    }

    if (!voteLocation) {
      setVoteError(
        "Search for the place and pick it from the list, so everyone voting knows exactly where this is about.",
      );
      return;
    }

    setVoteError(null);

    const closesAt = new Date(
      Date.now() + VOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    try {
      await addPoll.mutateAsync({ title: voteTitle.trim(), location: voteLocation, closesAt });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setVoteError(
        code === "AUTH_REQUIRED"
          ? "Sign in to propose a vote."
          : "Could not propose this vote. Please try again.",
      );
      return;
    }

    setVoteTitle("");
    setVoteLocation(null);
    setVoteComposerOpen(false);
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="title">Campus reports</Heading>
        <Text variant="body" color="textSecondary">
          Barriers reported at your school and nearby places.
        </Text>
      </View>

      <Button
        label="Report an issue"
        icon="add"
        size="lg"
        block
        onPress={openCreateComposer}
        accessibilityHint="Opens a form to describe an accessibility barrier"
      />

      <Button
        label="Propose a vote"
        icon="community"
        variant="outline"
        block
        onPress={openVoteComposer}
        accessibilityHint="Opens a form to put an accessibility change to the community"
      />

      {openVotes.length > 0 ? (
        <Section title="Open votes">
          <View style={styles.list}>
            {openVotes.map((poll) => (
              <VoteCallout
                key={poll.id}
                poll={poll}
                onVote={(selected) => votePoll.mutate(selected.id)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section
        title={`${visible.length} ${visible.length === 1 ? "report" : "reports"}`}
      >
        <ChipGroup
          label="Filter reports by status"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />

        {visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onPress={(report) => router.push(`/report/${report.id}` as never)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="resolved"
            title="Nothing here"
            message="No reports match this filter. Try selecting All."
          />
        )}
      </Section>

      <Composer
        visible={composerOpen}
        title="New report"
        description="Share the barrier you found so it shows up in the report feed."
        submitLabel="Save report"
        submitting={addReport.isPending}
        error={reportError}
        onSubmit={submitReport}
        onClose={() => setComposerOpen(false)}
      >
        <FormField
          label="What is the barrier?"
          value={title}
          onChangeText={(next) => {
            setTitle(next);
            setReportError(null);
          }}
          placeholder="e.g. Side entrance ramp is blocked"
        />
        <LocationPicker
          label="Location"
          value={location}
          onChange={(next) => {
            // Clear as soon as the complaint is addressed, so the banner never
            // tells someone to pick a place they have already picked.
            setLocation(next);
            setReportError(null);
          }}
        />
      </Composer>

      <Composer
        visible={voteComposerOpen}
        title="Propose a vote"
        description={`Put an accessibility change to the community. Voting stays open for ${VOTE_WINDOW_DAYS} days.`}
        submitLabel="Open the vote"
        submitting={addPoll.isPending}
        error={voteError}
        onSubmit={submitPoll}
        onClose={() => setVoteComposerOpen(false)}
      >
        <FormField
          label="What should change?"
          value={voteTitle}
          onChangeText={(next) => {
            setVoteTitle(next);
            setVoteError(null);
          }}
          placeholder="e.g. Add automatic door openers"
        />
        <LocationPicker
          label="Location"
          value={voteLocation}
          onChange={(next) => {
            setVoteLocation(next);
            setVoteError(null);
          }}
        />
      </Composer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.three,
    // A scrim, not a surface: it dims whatever is behind it in either scheme.
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    // Capped so a tall suggestion list scrolls inside the card rather than
    // running off the screen.
    maxHeight: "85%",
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  modalContent: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  form: {
    gap: Spacing.three,
  },
  error: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
  secondaryAction: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
