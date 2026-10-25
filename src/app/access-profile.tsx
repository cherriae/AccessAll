import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { LoadingState } from '@/components/ui/loading-state';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, useUpdateAccessNeeds } from '@/hooks/useSettings';
import { ACCESS_NEED_LABELS } from '@/lib/access-fit';
import { useAuthSession } from '@/lib/auth-context';
import { ACCESS_NEEDS, type AccessNeed } from '@/types';

export default function AccessProfileScreen() {
  const router = useRouter();
  const { userId, isReady } = useAuthSession();
  const settingsQuery = useSettings();
  const welcome = useLocalSearchParams<{ welcome?: string }>().welcome === '1';

  return (
    <Screen back>
      <PageHeader
        title={welcome ? 'Welcome to AccessAll' : 'My access profile'}
        subtitle={
          welcome
            ? 'One last thing: what matters to you? Every place will show how well it fits. Only you can see this, and you can skip it.'
            : 'Choose what matters to you. Every place then shows how well it fits you. Only you can see this.'
        }
        icon="accessibility"
        accent="campus"
      />
      {isReady && !userId ? (
        <>
          <EmptyState icon="accessibility" title="Sign in to set up your profile" message="Your access needs are saved to your account, so they follow you to every device." />
          <Button label="Sign in" onPress={() => router.push('/auth')} block />
        </>
      ) : settingsQuery.data ? (
        <NeedsForm initial={settingsQuery.data.accessNeeds} onSaved={welcome ? () => router.replace('/') : undefined} />
      ) : (
        <LoadingState label="Loading your profile" />
      )}
    </Screen>
  );
}

function NeedsForm({ initial, onSaved }: { initial: AccessNeed[]; onSaved?: () => void }) {
  const theme = useTheme();
  const updateNeeds = useUpdateAccessNeeds();
  const [needs, setNeeds] = useState<AccessNeed[]>(initial);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  function toggle(need: AccessNeed) {
    setMessage(null);
    setNeeds((current) => (current.includes(need) ? current.filter((value) => value !== need) : [...current, need]));
  }

  async function save() {
    try {
      await updateNeeds.mutateAsync(needs);
      if (onSaved) { onSaved(); return; }
      setMessage({
        text: needs.length ? 'Saved. Places in Explore now show how well they fit you.' : 'Saved. Places will no longer be scored for you.',
        tone: 'success',
      });
    } catch {
      setMessage({ text: 'Could not save your profile. Please try again.', tone: 'error' });
    }
  }

  return (
    <View style={styles.form}>
      {ACCESS_NEEDS.map((need) => {
        const selected = needs.includes(need);
        const { title, description } = ACCESS_NEED_LABELS[need];
        return (
          <Pressable
            key={need}
            onPress={() => toggle(need)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${title}. ${description}`}
          >
            <Card borderColor={selected ? theme.brand : undefined} style={[styles.option, selected ? styles.optionSelected : null]}>
              <View style={[styles.check, { borderColor: selected ? theme.brand : theme.borderStrong, backgroundColor: selected ? theme.brand : 'transparent' }]}>
                {selected ? <Icon name="resolved" size={18} color={theme.onBrand} /> : null}
              </View>
              <View style={styles.optionBody}>
                <Text variant="bodyStrong">{title}</Text>
                <Text variant="callout" color="textSecondary">{description}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Notice message={message?.text} tone={message?.tone} />
      <Button label={onSaved ? 'Save and start exploring' : 'Save access profile'} onPress={save} disabled={updateNeeds.isPending} block />
      {onSaved ? <Button label="Skip for now" variant="ghost" onPress={onSaved} block /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  optionSelected: { borderWidth: 2 },
  optionBody: { flex: 1, gap: Spacing.half },
  check: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
