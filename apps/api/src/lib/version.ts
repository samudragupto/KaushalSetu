// Monotonic counter bumped by every write path. The analytics cache is keyed on it, so the
// dashboard's 5-second poll returns fresh numbers immediately after a bot reply or approval.
let version = 1;

export function dataVersion(): number {
  return version;
}

export function bumpVersion(): number {
  version += 1;
  return version;
}
