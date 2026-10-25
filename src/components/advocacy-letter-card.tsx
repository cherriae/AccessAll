import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { advocacyMailto, buildAdvocacyLetter } from '@/lib/advocacy-letter';
import { publicUrl, shareText } from '@/lib/share';
import type { Report, User } from '@/types';

export interface AdvocacyLetterCardProps {
  report: Report;
  user?: User | null;
  commentCount: number;
}

/**
 * Drafts a formal request to school staff from the report, ready to send from
 * the student's own email so the reply comes back to them.
 */
export function AdvocacyLetterCard({ report, user, commentCount }: AdvocacyLetterCardProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const letter = buildAdvocacyLetter({
    report,
    senderName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
    senderAffiliation: user?.affiliation || undefined,
    commentCount,
    reportUrl: publicUrl(`/report/${report.id}`),
  });

  async function email() {
    setError(null);
    try {
      await Linking.openURL(advocacyMailto(letter, recipient));
    } catch {
      setError('No email app is set up on this device. Use Share instead.');
    }
  }

  if (!open) {
    return (
      <Card style={styles.card}>
        <Text variant="bodyStrong">Ask the school to fix this</Text>
        <Text color="textSecondary">
          Turn this report into a formal letter to school staff, with the evidence and the laws that apply.
        </Text>
        <Button label="Write the letter for me" icon="review" onPress={() => setOpen(true)} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant="bodyStrong">{letter.subject}</Text>
      <View style={[styles.letter, { backgroundColor: theme.backgroundElement }]}>
        <Text selectable>{letter.body}</Text>
      </View>
      <FormField
        label="Send to (optional)"
        value={recipient}
        onChangeText={setRecipient}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="principal@school.edu"
      />
      <Notice message={error} />
      <Notice message={notice} tone="success" />
      <View style={styles.row}>
        <Button label="Open in email" icon="review" onPress={email} />
        <Button
          label="Share"
          variant="outline"
          icon="community"
          onPress={async () => {
            setError(null);
            const outcome = await shareText(`${letter.subject}\n\n${letter.body}`, letter.subject);
            if (outcome === 'copied') setNotice('Letter copied. Paste it into an email or document.');
            if (outcome === 'failed') setError('Could not share the letter. Select the text above and copy it instead.');
          }}
        />
        <Button label="Close" variant="ghost" onPress={() => setOpen(false)} />
      </View>
      <Text variant="caption" color="textSecondary">Read it through and add anything personal before you send it.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  letter: { padding: Spacing.three, borderRadius: Radius.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
