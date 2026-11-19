// Explicit, stable order for uploaded tracks. Empty slots are skipped.
export function playlistUrls(slots) {
  if (!Array.isArray(slots)) return [];
  return slots.map(item => typeof item === 'string' ? item : item?.url)
    .filter(url => typeof url === 'string' && /^\/(?:music-custom(?:-[23])?\.(?:mp3|m4a|ogg|wav)|music\/shorts-[123]\.m4a)(?:\?v=\d+)?$/.test(url));
}
export function nextTrackIndex(current, count) {
  return Number.isInteger(count) && count > 0 ? ((current + 1) % count + count) % count : -1;
}
