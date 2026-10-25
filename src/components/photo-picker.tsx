import { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Radius, Spacing } from '@/constants/theme';
import { photoUrl, pickPhoto, uploadPhoto } from '@/lib/photos';

export interface PhotoPickerProps {
  /** Storage path of the attached photo, if any. */
  value?: string;
  onChange: (path: string | undefined) => void;
  /** Describes the photo for screen readers, e.g. "Photo for step 2". */
  label: string;
  /** Lets a form hold its save button while an upload is in flight. */
  onUploadingChange?: (uploading: boolean) => void;
}

/**
 * Attach one photo. It uploads as soon as it is picked, so the form that owns
 * it only ever holds a storage path.
 */
export function PhotoPicker({ value, onChange, label, onUploadingChange }: PhotoPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(source: 'library' | 'camera') {
    setError(null);
    let uploading = false;
    try {
      const uri = await pickPhoto(source);
      if (!uri) return;
      uploading = true;
      setBusy(true);
      onUploadingChange?.(true);
      onChange(await uploadPhoto(uri));
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      setError(
        code === 'CAMERA_DENIED' ? 'Camera access is off. Allow it in your settings, or choose an existing photo.'
          : code === 'AUTH_REQUIRED' ? 'Sign in to add photos.'
          : 'Could not upload the photo. Please try again.',
      );
    } finally {
      if (uploading) {
        setBusy(false);
        onUploadingChange?.(false);
      }
    }
  }

  return (
    <View style={styles.wrapper}>
      {value ? (
        <>
          <Image source={{ uri: photoUrl(value) }} style={styles.preview} accessibilityLabel={label} />
          <Button label="Remove photo" variant="ghost" icon="delete" onPress={() => onChange(undefined)} />
        </>
      ) : (
        <View style={styles.row}>
          <Button label={busy ? 'Uploading…' : 'Add photo'} variant="outline" onPress={() => choose('library')} disabled={busy} accessibilityLabel={`${label}: choose a photo`} />
          {Platform.OS !== 'web' ? (
            <Button label="Take photo" variant="outline" onPress={() => choose('camera')} disabled={busy} accessibilityLabel={`${label}: take a photo`} />
          ) : null}
        </View>
      )}
      <Notice message={error} />
    </View>
  );
}

/** A stored photo shown inline in a report or set of directions. */
export function StoredPhoto({ path, label }: { path: string; label: string }) {
  return <Image source={{ uri: photoUrl(path) }} style={styles.preview} accessibilityLabel={label} />;
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md },
});
