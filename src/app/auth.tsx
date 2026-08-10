import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { Heading, Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useSignIn, useSignUp } from '@/hooks/useAuth';

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState('accessall-demo');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const signIn = useSignIn();
  const signUp = useSignUp();
  const pending = signIn.isPending || signUp.isPending;

  async function submit() {
    try {
      if (mode === 'signin') {
        await signIn.mutateAsync({ email, password });
      } else {
        if (!firstName.trim() || !lastName.trim()) throw new Error('NAME_REQUIRED');
        await signUp.mutateAsync({ email, password, firstName, lastName, affiliation });
      }
      router.replace('/profile');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      Alert.alert(
        'Could not continue',
        code === 'ACCOUNT_EXISTS' ? 'An account already uses that email.'
          : code === 'NAME_REQUIRED' ? 'Enter your first and last name.'
          : 'Check your email and password. Passwords must contain at least 8 characters.',
      );
    }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Heading variant="display">{mode === 'signin' ? 'Welcome back' : 'Create an account'}</Heading>
        <Text color="textSecondary">Your account is stored on this device for this local MVP.</Text>
      </View>
      <Card style={styles.form}>
        <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {mode === 'signup' ? (
          <>
            <FormField label="First name" value={firstName} onChangeText={setFirstName} />
            <FormField label="Last name" value={lastName} onChangeText={setLastName} />
            <FormField label="School or organization" value={affiliation} onChangeText={setAffiliation} />
          </>
        ) : null}
        <Button label={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} disabled={pending} block />
        <Button
          label={mode === 'signin' ? 'Create a new account' : 'I already have an account'}
          variant="ghost"
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          block
        />
      </Card>
      {mode === 'signin' ? (
        <Text variant="caption" color="textSecondary" align="center">
          Demo: alex@example.com / accessall-demo
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ intro: { gap: Spacing.two }, form: { gap: Spacing.three } });
