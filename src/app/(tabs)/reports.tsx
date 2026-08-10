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
import { usePolls, useVotePoll } from "@/hooks/usePolls";
import {
    useSchoolReport,
    useSchoolReportAdd,
    useSchoolReportDelete,
    useSchoolReportUpdate,
} from "@/hooks/useSchoolReport";
import { REPORT_STATUS_DISPLAY } from "@/lib/display";
import type { Report, ReportStatus } from "@/types";
import { REPORT_STATUSES } from "@/types";

type Filter = "all" | ReportStatus;

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
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ReportStatus>("open");
  const reportsQuery = useSchoolReport();
  const addReport = useSchoolReportAdd();
  const updateReport = useSchoolReportUpdate();
  const deleteReport = useSchoolReportDelete();
  const pollsQuery = usePolls();
  const votePoll = useVotePoll();

  const visible =
    filter === "all"
      ? (reportsQuery.data ?? [])
      : (reportsQuery.data ?? []).filter((r) => r.status === filter);
  const openVotes = (pollsQuery.data ?? []).filter((poll) => !poll.hasVoted);

  const modalTitle = editingReport ? "Edit report" : "New report";

  function openCreateComposer() {
    setEditingReport(null);
    setTitle("");
    setLocation("");
    setStatus("open");
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

    if (editingReport) {
      await updateReport.mutateAsync({
        id: editingReport.id,
        title: title.trim(),
        location: location.trim(),
        status,
      });
    } else {
      await addReport.mutateAsync({
        title: title.trim(),
        location: location.trim(),
      });
    }

    setTitle("");
    setLocation("");
    setStatus("open");
    setEditingReport(null);
    setComposerOpen(false);
  }

  async function removeReport() {
    if (!editingReport) {
      return;
    }

    await deleteReport.mutateAsync(editingReport.id);
    setTitle("");
    setLocation("");
    setStatus("open");
    setEditingReport(null);
    setComposerOpen(false);
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
            <Heading variant="title">{modalTitle}</Heading>
            <Text variant="body" color="textSecondary">
              {editingReport
                ? "Update the report details or remove it from the feed."
                : "Share the barrier you found so it shows up in the report feed."}
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

              <ChipGroup
                label="Report status"
                options={REPORT_STATUSES.map((value) => ({
                  value,
                  label: REPORT_STATUS_DISPLAY[value].label,
                }))}
                value={status}
                onChange={setStatus}
              />
            </View>

            <View style={styles.modalActions}>
              {editingReport ? (
                <Pressable
                  onPress={removeReport}
                  style={styles.destructiveAction}
                  disabled={deleteReport.isPending}
                >
                  <Text variant="label" color="danger">
                    Delete
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setComposerOpen(false)}
                style={styles.secondaryAction}
              >
                <Text variant="label">Cancel</Text>
              </Pressable>
              <Button
                label={editingReport ? "Save changes" : "Save report"}
                onPress={submitReport}
                disabled={addReport.isPending}
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
  destructiveAction: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  secondaryAction: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
