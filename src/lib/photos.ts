import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { requireUserId, supabase } from './supabase';

const BUCKET = 'photos';
/** Wide enough to read a sign in the photo, small enough to load on mobile data. */
const MAX_WIDTH = 1600;

/**
 * Re-encodes a photo as a fresh JPEG before it is uploaded.
 *
 * Photos are public, and a phone photo's metadata usually includes the exact
 * GPS position it was taken at — for a student, often their home. Drawing the
 * pixels into a new file drops all of it. It also turns iPhone HEIC photos
 * into JPEG, which every browser can show.
 */
async function sanitise(uri: string): Promise<string> {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: MAX_WIDTH });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    return result.uri;
}

/**
 * Lets the user pick (or take) one photo. Returns its local URI, or null when
 * they cancel. Compressed here because the bucket caps uploads at 5 MB and
 * phone cameras routinely exceed that.
 */
export async function pickPhoto(source: 'library' | 'camera' = 'library'): Promise<string | null> {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false };

    if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('CAMERA_DENIED');
    }

    const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/**
 * Uploads a picked photo into the user's own folder (the only place the
 * storage policy lets them write) and returns its storage path.
 */
export async function uploadPhoto(uri: string): Promise<string> {
    const userId = await requireUserId();
    // ArrayBuffer rather than Blob: React Native's Blob cannot be sent as a
    // request body, while an ArrayBuffer works on every platform.
    const response = await fetch(await sanitise(uri));
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, await response.arrayBuffer(), { contentType: 'image/jpeg', upsert: false });

    if (error) throw new Error(error.message);
    return path;
}

/** Public URL for a stored photo path. */
export function photoUrl(path: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes photos the signed-in user uploaded. Paths outside their folder are skipped by policy. */
export async function deletePhotos(paths: string[]) {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(error.message);
}

/** Every photo in the signed-in user's folder; used when deleting the account. */
export async function deleteAllMyPhotos() {
    const userId = await requireUserId();
    for (;;) {
        const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) return;
        await deletePhotos(data.map((file) => `${userId}/${file.name}`));
    }
}
