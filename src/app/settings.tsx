import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useDeleteAccount } from '@/hooks/useAuth';
import { useCurrentUser, useUpdateProfile } from '@/hooks/useCurrentUser';
import { useBlockedUsers, useUnblockUser } from '@/hooks/useModeration';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useAuthSession } from '@/lib/auth-context';
import type { AppSettings, User } from '@/types';

type Message = { text: string; tone: 'error' | 'success' } | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { isReady } = useAuthSession();
  const userQuery = useCurrentUser();
  const settingsQuery = useSettings();
  const user = userQuery.data;
  const settings = settingsQuery.data;

  return (
    <Screen back>
      <PageHeader title="Settings" subtitle="Your profile, notifications and account." icon="settings" accent="community" />
      {!isReady || userQuery.isLoading || settingsQuery.isLoading ? (
        <LoadingState label="Loading settings" />
      ) : user && settings ? (
        <>
          <ProfileSection user={user} />
          <NotificationSection settings={settings} />
          <BlockedSection />
        </>
      ) : (
        <Card style={styles.form}>
          <Text color="textSecondary">Sign in to edit your profile and notifications.</Text>
          <Button label="Sign in" onPress={() => router.push('/auth')} />
        </Card>
      )}
      <Section title="Accessibility">
        <Card style={styles.form}>
          <Text>
            AccessAll uses your device&rsquo;s text size, bold text, reduce motion and screen
            reader settings, so the app matches every other app you use.
          </Text>
          {Platform.OS !== 'web' ? (
            <Button label="Open device settings" variant="outline" onPress={() => Linking.openSettings()} />
          ) : (
            <Text color="textSecondary">In a browser, use your browser zoom and operating system settings.</Text>
          )}
        </Card>
      </Section>
      <Section title="About accessibility information">
        <Card style={styles.form}>
          <Text>Accessibility details on AccessAll are contributed by the community, not audited by us. They describe what people found, which may have changed since.</Text>
          <Text color="textSecondary">Always check recent community reviews before visiting.</Text>
        </Card>
      </Section>
      <Section title="Help and feedback">
        <Button label="Email support" icon="help" variant="outline" onPress={() => Linking.openURL('mailto:support@accessall.app')} />
      </Section>
      {user ? <DeleteAccountSection /> : null}
    </Screen>
  );
}

function ProfileSection({ user }: { user: User }) {
  const updateProfile = useUpdateProfile();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [affiliation, setAffiliation] = useState(user.affiliation);
  const [message, setMessage] = useState<Message>(null);

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ text: 'Enter your first and last name.', tone: 'error' });
      return;
    }
    setMessage(null);
    try {
      await updateProfile.mutateAsync({ firstName, lastName, affiliation });
      setMessage({ text: 'Profile saved.', tone: 'success' });
    } catch {
      setMessage({ text: 'Could not save your profile. Please try again.', tone: 'error' });
    }
  }

  return (
    <Section title="Profile">
      <Card style={styles.form}>
        <FormField label="First name" value={firstName} onChangeText={setFirstName} maxLength={80} autoComplete="given-name" />
        <FormField label="Last name" value={lastName} onChangeText={setLastName} maxLength={80} autoComplete="family-name" />
        <FormField label="School or organization" value={affiliation} onChangeText={setAffiliation} maxLength={120} />
        <Notice message={message?.text} tone={message?.tone} />
        <Button label="Save profile" onPress={save} disabled={updateProfile.isPending} />
      </Card>
    </Section>
  );
}

/**
 * These gate the in-app notifications written by the database when someone
 * comments on, or changes the status of, a report you follow (0007).
 */
function NotificationSection({ settings }: { settings: AppSettings }) {
  const updateSettings = useUpdateSettings();
  // Shown immediately, so a switch does not snap back while the save is in
  // flight; reverted if the save fails.
  const [values, setValues] = useState({
    notificationsEnabled: settings.notificationsEnabled,
    reportUpdatesEnabled: settings.reportUpdatesEnabled,
  });
  const [error, setError] = useState<string | null>(null);

  async function setPreference(key: 'notificationsEnabled' | 'reportUpdatesEnabled', value: boolean) {
    const previous = values;
    const next = { ...values, [key]: value };
    setError(null);
    setValues(next);
    try {
      await updateSettings.mutateAsync({ ...settings, ...next });
    } catch {
      setValues(previous);
      setError('Could not save this setting. Please try again.');
    }
  }

  return (
    <Section title="Notifications">
      <Card style={styles.switches}>
        <SettingSwitch
          label="Allow notifications"
          value={values.notificationsEnabled}
          onChange={(value) => setPreference('notificationsEnabled', value)}
          disabled={updateSettings.isPending}
        />
        <SettingSwitch
          label="Replies and progress on my reports"
          value={values.notificationsEnabled && values.reportUpdatesEnabled}
          onChange={(value) => setPreference('reportUpdatesEnabled', value)}
          disabled={updateSettings.isPending || !values.notificationsEnabled}
        />
        <Text variant="caption" color="textSecondary">
          Notifications appear in your activity feed and on the bell on the home screen.
        </Text>
        <Notice message={error} />
      </Card>
    </Section>
  );
}

function BlockedSection() {
  const blocks = useBlockedUsers().data ?? [];
  const unblock = useUnblockUser();

  return (
    <Section title="Blocked people">
      <Card style={styles.form}>
        {blocks.length === 0 ? (
          <Text color="textSecondary">
            You have not blocked anyone. Use Report under someone&rsquo;s comment or review to block them.
          </Text>
        ) : (
          blocks.map((person) => (
            <View key={person.userId} style={styles.switchRow}>
              <Text variant="bodyStrong" style={styles.switchLabel}>{person.name}</Text>
              <Button label="Unblock" variant="outline" onPress={() => unblock.mutate(person.userId)} disabled={unblock.isPending} accessibilityLabel={`Unblock ${person.name}`} />
            </View>
          ))
        )}
      </Card>
    </Section>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const deleteAccount = useDeleteAccount();
  // Two taps, because `Alert` confirmations do nothing on web.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirming) { setConfirming(true); return; }
    setError(null);
    try {
      await deleteAccount.mutateAsync();
      router.replace('/');
    } catch {
      setConfirming(false);
      setError('Could not delete your account. Please try again.');
    }
  }

  return (
    <Section title="Delete account">
      <Card style={styles.form}>
        <Text color="textSecondary">
          Deletes your profile, reviews, comments and votes. Reports you filed stay
          visible without your name, because other people may be affected by them.
        </Text>
        <Notice message={error} />
        <Button
          label={confirming ? 'Tap again to permanently delete' : 'Delete my account'}
          variant="outline"
          icon="delete"
          onPress={remove}
          disabled={deleteAccount.isPending}
        />
      </Card>
    </Section>
  );
}

function SettingSwitch({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.switchRow}>
      <Text variant="bodyStrong" style={styles.switchLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three }, switches: { gap: Spacing.two },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  switchLabel: { flex: 1 },
});
