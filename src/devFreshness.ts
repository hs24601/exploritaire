import build from 'virtual:proto-build';

// Mobile browsers suspend WebSockets in the background. Check over HTTP as well,
// so resuming a playtest cannot silently keep an older scene/data module graph.
let checking = false;
let reloading = false;
async function checkRevision() {
  if (document.hidden || checking || reloading) return;
  checking = true;
  try {
    const response = await fetch(`/__playtest-revision?t=${Date.now()}`, {
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;
    const { revision } = await response.json();
    if (typeof revision === 'string' && revision !== build.revision) {
      reloading = true;
      window.location.reload();
    }
  } catch {
    // Offline tailnet devices retry after reconnecting; never reload on failure.
  } finally {
    checking = false;
  }
}
window.addEventListener('pageshow', checkRevision);
window.addEventListener('online', checkRevision);
window.addEventListener('focus', checkRevision);
document.addEventListener('visibilitychange', checkRevision);
window.setInterval(checkRevision, 15000);
void checkRevision();

