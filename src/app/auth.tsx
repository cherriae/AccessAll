import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Heading, Text } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useAccent, useTheme } from '@/hooks/use-theme';
import { useRequestPasswordReset, useSignIn, useSignUp, useUpdatePassword } from '@/hooks/useAuth';
import { useAuthSession } from '@/lib/auth-context';

type Mode = 'signin' | 'signup' | 'forgot';
type AuthView = Mode | 'recover';

const HEADINGS: Record<AuthView, { title: string; subtitle: string }> = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to report barriers, review places and follow what gets fixed.' },
  signup: { title: 'Join AccessAll', subtitle: 'Help make your school and city easier to get around, for everyone.' },
  forgot: { title: 'Reset your password', subtitle: 'Enter your email and we will send you a link to choose a new password.' },
  recover: { title: 'Choose a new password', subtitle: 'Pick something at least 8 characters long.' },
};

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'campus', text: 'Report barriers at school and see them fixed' },
  { icon: 'accessibility', text: 'Places scored for your own access needs' },
  { icon: 'quiet', text: 'Find quieter, sensory-friendly spaces' },
];

function errorMessage(code: string) {
  const lower = code.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (lower.includes('network') || lower.includes('fetch')) return 'Could not reach AccessAll. Check your connection and try again.';
  switch (code) {
    case 'ACCOUNT_EXISTS': return 'An account already uses that email. Try signing in instead.';
    case 'NAME_REQUIRED': return 'Enter your first and last name.';
    case 'EMAIL_REQUIRED': return 'Enter the email address you signed up with.';
    case 'CONFIRM_EMAIL': return 'Confirm your email address first: open the link we sent you, then sign in.';
    case 'INVALID_CREDENTIALS': return 'That email and password do not match. Passwords have at least 8 characters.';
    default: return code || 'Something went wrong. Please try again.';
  }
}

export default function AuthScreen() {
  const router = useRouter();
  const theme = useTheme();
  const brand = useAccent('campus');
  const { session, isReady, isRecovering, endRecovery } = useAuthSession();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set once this screen navigates away itself, so the redirect below does not
  // also fire and send the user to Profile instead of back where they were.
  const [leaving, setLeaving] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const affiliationRef = useRef<TextInput>(null);
  const signIn = useSignIn();
  const signUp = useSignUp();
  const requestReset = useRequestPasswordReset();
  const updatePassword = useUpdatePassword();
  const pending = signIn.isPending || signUp.isPending || requestReset.isPending || updatePassword.isPending;
  const view: AuthView = isRecovering ? 'recover' : mode;

  // Already signed in (and not here to reset a password): nothing to do here.
  if (isReady && session && !isRecovering && !pending && !leaving) return <Redirect href="/profile" />;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  /** Back to wherever sign-in was asked for, e.g. the place being reviewed. */
  function leave() {
    setLeaving(true);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }

  async function submit() {
    if (pending) return;
    setError(null);
    setNotice(null);

    try {
      if (view === 'recover') {
        await updatePassword.mutateAsync(password);
        endRecovery();
      } else if (view === 'forgot') {
        await requestReset.mutateAsync(email);
        setNotice('If an account uses that email, a reset link is on its way. Open it on this device.');
        return;
      } else if (view === 'signin') {
        await signIn.mutateAsync({ email, password });
      } else {
        if (!firstName.trim() || !lastName.trim()) throw new Error('NAME_REQUIRED');
        await signUp.mutateAsync({ email, password, firstName, lastName, affiliation });
        // A brand-new account has no access needs yet; ask now, while the
        // reason for asking is fresh.
        setLeaving(true);
        router.replace('/access-profile?welcome=1' as never);
        return;
      }
      leave();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      // With email confirmation on, sign-up succeeded: say so, not as an error.
      if (view === 'signup' && code === 'CONFIRM_EMAIL') {
        setMode('signin');
        setPassword('');
        setNotice(`Account created. We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`);
        return;
      }
      setError(errorMessage(code));
    }
  }

  const submitLabel = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', recover: 'Save new password' }[view];
  const showsTabs = view === 'signin' || view === 'signup';

  return (
    <Screen back>
      <View style={styles.hero}>
        <View style={[styles.mark, { backgroundColor: brand.solid }]}>
          <Icon name="accessibility" size={34} color={brand.onSolid} />
        </View>
        <Heading variant="display" align="center">{HEADINGS[view].title}</Heading>
        <Text color="textSecondary" align="center">{HEADINGS[view].subtitle}</Text>
      </View>

      {showsTabs ? (
        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          {(['signin', 'signup'] as const).map((tab) => {
            const selected = view === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => switchMode(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.tab, selected ? { backgroundColor: theme.surface, borderColor: theme.border } : null]}
              >
                <Text variant="label" color={selected ? 'text' : 'textSecondary'}>
                  {tab === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Card style={styles.form}>
        {view !== 'recover' ? (
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType={view === 'forgot' ? 'send' : 'next'}
            submitBehavior={view === 'forgot' ? 'blurAndSubmit' : 'submit'}
            onSubmitEditing={() => (view === 'forgot' ? submit() : passwordRef.current?.focus())}
          />
        ) : null}
        {view !== 'forgot' ? (
          <FormField
            ref={passwordRef}
            label={view === 'recover' ? 'New password' : 'Password'}
            hint={view === 'signin' ? undefined : 'At least 8 characters.'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
            textContentType={view === 'signin' ? 'password' : 'newPassword'}
            returnKeyType={view === 'signup' ? 'next' : 'go'}
            submitBehavior={view === 'signup' ? 'submit' : 'blurAndSubmit'}
            onSubmitEditing={() => (view === 'signup' ? firstNameRef.current?.focus() : submit())}
          />
        ) : null}
        {view === 'signup' ? (
          <>
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <FormField ref={firstNameRef} label="First name" value={firstName} onChangeText={setFirstName} maxLength={80} autoComplete="given-name" textContentType="givenName" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => lastNameRef.current?.focus()} />
              </View>
              <View style={styles.nameField}>
                <FormField ref={lastNameRef} label="Last name" value={lastName} onChangeText={setLastName} maxLength={80} autoComplete="family-name" textContentType="familyName" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => affiliationRef.current?.focus()} />
              </View>
            </View>
            <FormField
              ref={affiliationRef}
              label="School or organization (optional)"
              value={affiliation}
              onChangeText={setAffiliation}
              maxLength={120}
              textContentType="organizationName"
              returnKeyType="go"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={submit}
            />
            <Text variant="caption" color="textSecondary">
              Other people see you as your first name and last initial. Your email and school stay private.
            </Text>
          </>
        ) : null}
        <Notice message={error} />
        <Notice message={notice} tone="success" />
        <Button label={pending ? 'Please wait…' : submitLabel} onPress={submit} disabled={pending} size="lg" block />
        {view === 'signin' ? (
          <Button label="Forgot password?" variant="ghost" onPress={() => switchMode('forgot')} block />
        ) : view === 'forgot' ? (
          <Button label="Back to sign in" variant="ghost" onPress={() => switchMode('signin')} block />
        ) : null}
      </Card>

      {view === 'signup' || view === 'signin' ? (
        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.text} style={styles.benefit}>
              <Icon name={benefit.icon} color={brand.fg} />
              <Text variant="callout" color="textSecondary" style={styles.benefitText}>{benefit.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.two },
  mark: { width: 72, height: 72, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  tabs: { flexDirection: 'row', padding: Spacing.one, borderRadius: Radius.lg },
  tab: { flex: 1, minHeight: MinTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent' },
  form: { gap: Spacing.three },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  nameField: { flexGrow: 1, flexBasis: 140 },
  benefits: { gap: Spacing.two, paddingHorizontal: Spacing.two },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  benefitText: { flex: 1 },
});
