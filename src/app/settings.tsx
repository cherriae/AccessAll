import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser, useUpdateProfile } from '@/hooks/useCurrentUser';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';

export default function SettingsScreen() {
  const user = useCurrentUser().data;
  const settings = useSettings().data;
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const [firstName, setFirstName] = useState<string>();
  const [lastName, setLastName] = useState<string>();
  const [affiliation, setAffiliation] = useState<string>();

  const setPreference = (key: 'notificationsEnabled' | 'reportUpdatesEnabled' | 'voteRemindersEnabled', value: boolean) => {
    if (settings) updateSettings.mutate({ ...settings, [key]: value });
  };

  return (
    <Screen>
      <Heading variant="display">Settings</Heading>
      <Section title="Profile">
        <Card style={styles.form}>
          {user ? (
            <>
              <FormField label="First name" value={firstName ?? user.firstName} onChangeText={setFirstName} />
              <FormField label="Last name" value={lastName ?? user.lastName} onChangeText={setLastName} />
              <FormField label="School or organization" value={affiliation ?? user.affiliation} onChangeText={setAffiliation} />
              <Button label="Save profile" onPress={() => updateProfile.mutate({ firstName: firstName ?? user.firstName, lastName: lastName ?? user.lastName, affiliation: affiliation ?? user.affiliation })} disabled={updateProfile.isPending} />
            </>
          ) : <Text color="textSecondary">Sign in to edit your profile.</Text>}
        </Card>
      </Section>
      <Section title="Notifications">
        <Card style={styles.switches}>
          <SettingSwitch label="Allow notifications" value={settings?.notificationsEnabled ?? false} onChange={(value) => setPreference('notificationsEnabled', value)} />
          <SettingSwitch label="Report progress updates" value={settings?.reportUpdatesEnabled ?? false} onChange={(value) => setPreference('reportUpdatesEnabled', value)} />
          <SettingSwitch label="Open vote reminders" value={settings?.voteRemindersEnabled ?? false} onChange={(value) => setPreference('voteRemindersEnabled', value)} />
        </Card>
      </Section>
      <Section title="About verification">
        <Card style={styles.form}>
          <Text>Verified places have accessibility information reviewed for consistency. Verification is not a guarantee that every person’s access needs will be met.</Text>
          <Text color="textSecondary">Always check recent community reviews before visiting.</Text>
        </Card>
      </Section>
      <Section title="Help and feedback">
        <Button label="Email support" icon="help" variant="outline" onPress={() => Linking.openURL('mailto:support@accessall.app')} />
      </Section>
    </Screen>
  );
}

function SettingSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.switchRow}><Text variant="bodyStrong" style={styles.switchLabel}>{label}</Text><Switch value={value} onValueChange={onChange} accessibilityLabel={label} /></View>;
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three }, switches: { gap: Spacing.two },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  switchLabel: { flex: 1 },
});
