import { Flagify, type FlagifyOptions } from "@flagify/node";

let client: Flagify | null = null;
let clientReady: Promise<void> | null = null;

/**
 * Initialize the singleton Flagify client.
 * Subsequent calls are no-ops if the client already exists.
 */
export function initClient(config: FlagifyOptions): void {
  if (client) return;
  client = new Flagify(config);
  clientReady = client.ready();
}

/**
 * Returns the singleton Flagify client, or null if not initialized.
 */
export function getClient(): Flagify | null {
  return client;
}

/**
 * Waits for the client to complete its initial flag sync.
 */
export async function waitForClient(): Promise<Flagify | null> {
  if (clientReady) await clientReady;
  return client;
}

/**
 * Destroy the singleton client and free resources.
 */
export function destroyClient(): void {
  client?.destroy();
  client = null;
  clientReady = null;
}
