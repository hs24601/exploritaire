let sequence = 0;

/** Session-local identities also work on plain HTTP LAN/Tailscale URLs. */
export function createRuntimeId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `proto-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
}
