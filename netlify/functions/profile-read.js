import { jsonResponse, readStoredProfile } from './profileStore.js';

export async function handler() {
  try {
    const profile = await readStoredProfile();
    return jsonResponse(200, { profile });
  } catch (err) {
    return jsonResponse(500, {
      error: 'profile_read_failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
