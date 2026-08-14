import { useState } from "react";
import { useRouter } from "expo-router";
import {
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { ReportRow } from "@/components/report-row";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Heading, Text } from "@/components/ui/text";
import { VoteCallout } from "@/components/vote-callout";
import { Spacing } from "@/constants/theme";
import { useAddPoll, usePolls, useVotePoll } from "@/hooks/usePolls";
import { useSchoolReport, useSchoolReportAdd } from "@/hooks/useSchoolReport";
import { REPORT_STATUS_DISPLAY } from "@/lib/display";
import type { ReportStatus } from "@/types";
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

export default function ReportsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const reportsQuery = useSchoolReport();
  const addReport = useSchoolReportAdd();
  const pollsQuery = usePolls();
  const votePoll = useVotePoll();
  const addPoll = useAddPoll();
  const [voteComposerOpen, setVoteComposerOpen] = useState(false);
  const [voteTitle, setVoteTitle] = useState("");
  const [voteLocation, setVoteLocation] = useState("");

  const visible =
    filter === "all"
      ? (reportsQuery.data ?? [])
      : (reportsQuery.data ?? []).filter((r) => r.status === filter);
  const openVotes = (pollsQuery.data ?? []).filter((poll) => !poll.hasVoted);

  function openCreateComposer() {
    setTitle("");
    setLocation("");
    setComposerOpen(true);
  }

  async function submitReport() {
    if (!title.trim() || !location.trim()) {
      Alert.alert(
        "Add a title and location",
        "Both fields are required to file a report.",
      );
      return;
    }

    try {
      await addReport.mutateAsync({
        title: title.trim(),
        location: location.trim(),
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      Alert.alert(
        "Could not save this report",
        code === "AUTH_REQUIRED"
          ? "Sign in to file a report."
          : "Please try again.",
      );
      return;
    }

    setTitle("");
    setLocation("");
    setComposerOpen(false);
  }

  async function submitPoll() {
    if (!voteTitle.trim() || !voteLocation.trim()) {
      Alert.alert(
        "Add a title and location",
        "Both fields are required to propose a vote.",
      );
      return;
    }

    const closesAt = new Date(
      Date.now() + VOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    try {
      await addPoll.mutateAsync({
        title: voteTitle.trim(),
        location: voteLocation.trim(),
        closesAt,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      Alert.alert(
        "Could not propose this vote",
        code === "AUTH_REQUIRED"
          ? "Sign in to propose a vote."
          : "Please try again.",
      );
      return;
    }

    setVoteTitle("");
    setVoteLocation("");
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
        onPress={() => setVoteComposerOpen(true)}
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

      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Heading variant="title">New report</Heading>
            <Text variant="body" color="textSecondary">
              Share the barrier you found so it shows up in the report feed.
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Report title"
                placeholderTextColor="#7A7A7A"
              />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Location"
                placeholderTextColor="#7A7A7A"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setComposerOpen(false)}
                style={styles.secondaryAction}
              >
                <Text variant="label">Cancel</Text>
              </Pressable>
              <Button
                label="Save report"
                onPress={submitReport}
                disabled={addReport.isPending}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={voteComposerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setVoteComposerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Heading variant="title">Propose a vote</Heading>
            <Text variant="body" color="textSecondary">
              {`Put an accessibility change to the community. Voting stays open for ${VOTE_WINDOW_DAYS} days.`}
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={voteTitle}
                onChangeText={setVoteTitle}
                placeholder="What should change?"
                placeholderTextColor="#7A7A7A"
              />
              <TextInput
                style={styles.input}
                value={voteLocation}
                onChangeText={setVoteLocation}
                placeholder="Location"
                placeholderTextColor="#7A7A7A"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setVoteComposerOpen(false)}
                style={styles.secondaryAction}
              >
                <Text variant="label">Cancel</Text>
              </Pressable>
              <Button
                label="Open the vote"
                onPress={submitPoll}
                disabled={addPoll.isPending}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
    backgroundColor: "white",
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderColor: "#D0D0D0",
    color: "#111111",
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
