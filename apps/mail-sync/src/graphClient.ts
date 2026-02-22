import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing GRAPH_TENANT_ID, GRAPH_CLIENT_ID, or GRAPH_CLIENT_SECRET in .env"
    );
  }

  const response = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: clientId,
      scope: "https://graph.microsoft.com/.default",
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = now + response.data.expires_in * 1000 - 60000;
  return cachedToken!;
}

/**
 * Pre-flight check: validate credentials and print a clear diagnostic.
 * Returns true if auth succeeds, false if it fails.
 */
export async function validateCredentials(): Promise<boolean> {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  console.log("\n--- Credential Check ---");
  console.log(`  Tenant ID:     ${tenantId}`);
  console.log(`  Client ID:     ${clientId}`);
  console.log(`  Client Secret: ${clientSecret ? clientSecret.slice(0, 6) + "..." : "(empty)"}`);

  if (!tenantId || !clientId || !clientSecret) {
    console.error("\n  FAIL: Missing one or more env vars. Check apps/mail-sync/.env");
    return false;
  }

  // Sanity: Client ID should be a GUID (8-4-4-4-12)
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guidPattern.test(clientId)) {
    console.error(`\n  FAIL: GRAPH_CLIENT_ID does not look like a GUID.`);
    console.error(`  Got: "${clientId}"`);
    console.error(`  Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
    console.error(`  → Go to Azure Portal → Entra ID → App registrations → Your App → Overview`);
    console.error(`  → Copy "Application (client) ID" and set it as GRAPH_CLIENT_ID`);
    return false;
  }

  try {
    await getAccessToken();
    console.log("  OK: Authentication successful!\n");
    return true;
  } catch (err: any) {
    const d = err.response?.data;
    if (!d) {
      console.error(`\n  FAIL: Network error — ${err.message}`);
      return false;
    }

    console.error(`\n  FAIL: ${d.error}`);

    if (d.error_description?.includes("was not found in the directory")) {
      console.error(`\n  The Client ID "${clientId}" is NOT registered in tenant "${tenantId}".`);
      console.error(`  This tenant resolves to: cloudresources.net\n`);
      console.error("  Most likely cause:");
      console.error("    You copied the Secret ID instead of the Application (Client) ID.\n");
      console.error("  Fix:");
      console.error("    1. Go to https://portal.azure.com");
      console.error("    2. Navigate to: Entra ID → App registrations → Your App");
      console.error("    3. On the Overview page, copy 'Application (client) ID'");
      console.error("    4. Update GRAPH_CLIENT_ID in apps/mail-sync/.env AND root .env");
      console.error("    5. Re-run: cd apps/mail-sync && npx tsx src/index.ts\n");
    } else if (d.error === "invalid_client") {
      console.error("\n  The Client Secret is invalid or expired.");
      console.error("  Fix: Go to App registrations → Certificates & secrets → New client secret");
      console.error("  Copy the VALUE (not the Secret ID) → update GRAPH_CLIENT_SECRET\n");
    } else if (d.error_description?.includes("consent")) {
      console.error("\n  Admin consent not granted for Mail.Read.");
      console.error("  Fix: App registrations → API permissions → Grant admin consent\n");
    } else {
      console.error(`  ${d.error_description}\n`);
    }
    return false;
  }
}
