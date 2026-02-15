import {
  initBlobsContext,
  jsonResponse,
  mergeProfilePatch,
  readStoredProfile,
  writeStoredProfile,
} from '../profileStore.js';

function parseBody(event) {
  if (!event?.body) return {};
  try {
    const parsed = JSON.parse(event.body);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const patch = parseBody(event);
  if (patch === null) {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  try {
    initBlobsContext(event);
    const existingProfile = await readStoredProfile();
    const mergedProfile = mergeProfilePatch(existingProfile, patch);
    const savedProfile = await writeStoredProfile(mergedProfile);

    return jsonResponse(200, {
      ok: true,
      updatedAt: savedProfile?.updatedAt || null,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: 'profile_write_failed',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
