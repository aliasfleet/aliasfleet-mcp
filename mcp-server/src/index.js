#!/usr/bin/env node

/**
 * AliasFleet Official Model Context Protocol (MCP) Server
 * Enables Claude, Cursor, Windsurf, and custom AI agents to programmatically provision
 * dedicated forwarding addresses, inspect account identity, and manage webhooks.
 */

import readline from 'readline';

const API_BASE_URL = process.env.ALIASFLEET_API_BASE_URL || 'https://api.aliasfleet.com';
const API_KEY = process.env.ALIASFLEET_API_KEY || '';

// In-memory mock store for local simulation and testing
const mockStore = {
  inboxes: [
    {
      id: "9f83a21b-4c7d-4e9a-8b7c-6d5e4f3a2b1c",
      local_part: "agent-preview",
      domain: "aliasfleet.com",
      full_address: "agent-preview@aliasfleet.com",
      description: "Local simulation test inbox",
      active: true,
      created_at: new Date().toISOString()
    }
  ],
  webhooks: []
};

export const TOOLS = [
  {
    name: "aliasfleet_create_inbox",
    description: "Provision a dedicated forwarding address and programmable inbox for an AI agent to receive emails, OTP verification codes, and webhooks without exposing real personal or corporate credentials.",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "Descriptive label or task name (e.g. 'browser-agent-signup', 'claude-task-42')."
        },
        local_part: {
          type: "string",
          description: "Optional prefix for the email address (e.g. 'agent-qa'). Generates random 8-character string if omitted."
        },
        domain_id: {
          type: "string",
          description: "Optional custom domain UUID. If omitted, the server automatically resolves and uses your account's default or active domain."
        },
        forward_to_email: {
          type: "string",
          description: "Optional verified forwarding destination email."
        }
      }
    }
  },
  {
    name: "aliasfleet_list_inboxes",
    description: "List all active dedicated forwarding addresses and privacy aliases managed under the AliasFleet account.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of inboxes to return (default 20)."
        }
      }
    }
  },
  {
    name: "aliasfleet_setup_webhook",
    description: "Register an HTTPS webhook endpoint to receive instant JSON email events (email.received) and verification codes with HMAC-SHA256 signatures.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The HTTPS URL where incoming email events should be dispatched."
        },
        name: {
          type: "string",
          description: "Descriptive name for the webhook endpoint (e.g. 'agent-otp-listener')."
        },
        format: {
          type: "string",
          enum: ["parsed_json", "metadata_only", "raw_mime", "slack", "discord"],
          description: "Payload format. Default is 'parsed_json'."
        }
      },
      required: ["url"]
    }
  },
  {
    name: "aliasfleet_get_account_info",
    description: "Inspect API authentication identity, current subscription tier (Free, Pro, Business), active quotas, and verified domains.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

async function callAliasFleetApi(endpoint, options = {}, requestApiKey = API_KEY) {
  const effectiveKey = requestApiKey || API_KEY;

  // Simulation mode is explicitly enabled only
  if (process.env.ALIASFLEET_MOCK === "true") {
    return handleMockRequest(endpoint, options);
  }

  // Keep local stdio development backward-compatible
  if (!effectiveKey && process.env.NODE_ENV !== "production") {
    return handleMockRequest(endpoint, options);
  }

  if (!effectiveKey) {
    throw new Error("Missing AliasFleet API key.");
  }

  const url = `${API_BASE_URL.replace(/\/+$/, '')}${endpoint}`;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${effectiveKey}`,
    'User-Agent': 'AliasFleet-MCP-Server/1.0',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(formatApiError(data, response));
  }

  return data;
}

function formatApiError(data, response) {
  if (data?.error) {
    if (typeof data.error === 'object') {
      if (Array.isArray(data.error.issues) && data.error.issues.length > 0) {
        const issuesText = data.error.issues
          .map(i => `${i.path?.join('.') || 'param'}: ${i.message}`)
          .join(', ');
        return `API validation error: ${issuesText}`;
      }
      return JSON.stringify(data.error);
    }
    return String(data.error);
  }
  if (data?.message) {
    return typeof data.message === 'object' ? JSON.stringify(data.message) : String(data.message);
  }
  if (data?.detail) {
    return typeof data.detail === 'object' ? JSON.stringify(data.detail) : String(data.detail);
  }
  return `HTTP ${response.status} ${response.statusText}`;
}

function handleMockRequest(endpoint, options = {}) {
  const method = options.method || 'GET';

  if (endpoint === '/v1/me') {
    return {
      user_id: "00000000-0000-0000-0000-000000000001",
      email: "agent@developer.local",
      tier: "business",
      auth_type: "api_key",
      mode: "local_simulation",
      scopes: ["aliases:read", "aliases:write", "webhooks:read", "webhooks:write"]
    };
  }

  if (endpoint === '/v1/aliases' && method === 'POST') {
    const body = options.body || {};
    const prefix = body.local_part || `agent-${Math.random().toString(36).substring(2, 10)}`;
    const newInbox = {
      id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      local_part: prefix,
      domain: "aliasfleet.com",
      full_address: `${prefix}@aliasfleet.com`,
      description: body.description || body.label || "Agent dedicated forwarding address",
      active: true,
      created_at: new Date().toISOString()
    };
    mockStore.inboxes.unshift(newInbox);
    return {
      success: true,
      alias: newInbox,
      simulation: true
    };
  }

  if (endpoint.startsWith('/v1/aliases') && method === 'GET') {
    return {
      success: true,
      aliases: mockStore.inboxes,
      total: mockStore.inboxes.length,
      simulation: true
    };
  }

  if (endpoint === '/v1/webhooks/endpoints' && method === 'POST') {
    const body = options.body || {};
    const mockSecret = `af_whsec_mock_${Math.random().toString(36).substring(2, 15)}`;
    const newWebhook = {
      id: `wh-${Date.now()}`,
      name: body.name || "Agent Webhook",
      url: body.url,
      format: body.format || "parsed_json",
      secret: mockSecret,
      secret_key: mockSecret,
      active: true,
      created_at: new Date().toISOString()
    };
    mockStore.webhooks.unshift(newWebhook);
    return {
      success: true,
      endpoint: newWebhook,
      simulation: true
    };
  }

  return { success: true, message: "Mock endpoint executed", endpoint, simulation: true };
}

let cachedDefaultDomainId = null;

async function resolveDefaultDomainId(apiKey) {
  if (cachedDefaultDomainId) return cachedDefaultDomainId;

  // 1. Try querying /v1/user/default-domain
  try {
    const res = await callAliasFleetApi('/v1/user/default-domain', {}, apiKey);
    const id = res?.default_domain?.id || res?.id || res?.domain_id;
    if (id) {
      cachedDefaultDomainId = id;
      return id;
    }
  } catch {
    // Fallback to active aliases inspection
  }

  // 2. Try borrowing domain_id from active aliases (/v1/aliases?limit=5)
  try {
    const res = await callAliasFleetApi('/v1/aliases?limit=5', {}, apiKey);
    const aliases = res?.aliases || res?.data || [];
    if (Array.isArray(aliases)) {
      const found = aliases.find(a => a.domain_id || a.domain?.id);
      const id = found?.domain_id || found?.domain?.id;
      if (id) {
        cachedDefaultDomainId = id;
        return id;
      }
    }
  } catch {
    // Fallback to domains list
  }

  // 3. Try querying /v1/domains if developer key has domains scope
  try {
    const res = await callAliasFleetApi('/v1/domains', {}, apiKey);
    const domains = res?.domains || res?.data || [];
    if (Array.isArray(domains) && domains.length > 0) {
      const defaultDomain = domains.find(d => d.is_default || d.is_primary) || domains[0];
      if (defaultDomain?.id) {
        cachedDefaultDomainId = defaultDomain.id;
        return defaultDomain.id;
      }
    }
  } catch {
    // Handled
  }

  return undefined;
}

export async function handleToolCall(name, args, apiKey = API_KEY) {
  switch (name) {
    case "aliasfleet_create_inbox": {
      let domainId = args.domain_id;
      if (!domainId && process.env.ALIASFLEET_MOCK !== "true") {
        domainId = await resolveDefaultDomainId(apiKey);
      }
      const payload = {
        description: args.label || "AI Agent Programmable Inbox",
        local_part: args.local_part || undefined,
        domain_id: domainId || undefined,
        forward_to_email: args.forward_to_email || undefined
      };
      const result = await callAliasFleetApi('/v1/aliases', {
        method: 'POST',
        body: payload
      }, apiKey);
      const alias = result.alias || result;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              email_address: alias.full_address || alias.full_alias || `${alias.local_part}@${alias.domain || 'aliasfleet.com'}`,
              alias_id: alias.id,
              description: alias.description,
              active: alias.active ?? alias.is_active ?? true,
              simulation: result.simulation || false,
              instructions: "Use this email_address for web signups, OTP verifications, or incoming agent routing. Inbound messages will forward to your destination or webhook."
            }, null, 2)
          }
        ]
      };
    }

    case "aliasfleet_list_inboxes": {
      const result = await callAliasFleetApi('/v1/aliases', {}, apiKey);
      const inboxes = result.aliases || result.data || mockStore.inboxes;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: inboxes.length,
              inboxes: inboxes.map(item => ({
                id: item.id,
                email_address: item.full_address || `${item.local_part}@${item.domain}`,
                description: item.description,
                active: item.active
              }))
            }, null, 2)
          }
        ]
      };
    }

    case "aliasfleet_setup_webhook": {
      const result = await callAliasFleetApi('/v1/webhooks/endpoints', {
        method: 'POST',
        body: {
          url: args.url,
          name: args.name || "Agent Listener",
          format: args.format || "parsed_json"
        }
      }, apiKey);
      const endpoint = result.endpoint || result;
      const signingSecret = endpoint?.secret_key || endpoint?.secret || result?.secret_key || result?.secret || "Configure in AliasFleet dashboard";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              endpoint_id: endpoint?.id,
              url: args.url,
              format: args.format || "parsed_json",
              signing_secret: signingSecret,
              note: "Inbound emails will now fire HMAC-signed JSON events directly to this URL."
            }, null, 2)
          }
        ]
      };
    }

    case "aliasfleet_get_account_info": {
      const result = await callAliasFleetApi('/v1/me', {}, apiKey);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              account: result.email,
              tier: result.tier,
              auth_type: result.auth_type,
              scopes: result.scopes,
              simulation: result.mode === "local_simulation"
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function startMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request;
    try {
      request = JSON.parse(trimmed);
    } catch {
      return;
    }

    const { id, method, params } = request;

    if (method === 'initialize') {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "aliasfleet-mcp",
            version: "1.0.1"
          }
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'notifications/initialized') {
      return;
    }

    if (method === 'ping') {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {}
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/list') {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/call') {
      try {
        const { name, arguments: toolArgs } = params || {};
        const result = await handleToolCall(name, toolArgs || {});
        const response = {
          jsonrpc: "2.0",
          id,
          result
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (err) {
        const response = {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32603,
            message: err.message || "Internal error executing tool"
          }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
      return;
    }

    if (id !== undefined) {
      const response = {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  });
}

// Start server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer();
}
