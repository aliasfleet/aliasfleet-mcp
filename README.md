# AliasFleet Model Context Protocol (MCP) Server & Agent Toolkit

[![npm version](https://img.shields.io/badge/npm-aliasfleet--mcp-blue.svg)](https://www.npmjs.com/package/aliasfleet-mcp)
[![MCP Standard](https://img.shields.io/badge/MCP-2024--11--05-green.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Official Model Context Protocol (MCP) server and Python SDK for AliasFleet. Provision dedicated forwarding addresses, programmable inboxes, and receive instant HMAC-signed email events for Claude Desktop, Cursor, Windsurf, Browser-Use, and Playwright agents.

---

## Why AliasFleet for AI Agents?

Giving an autonomous AI agent your real email address exposes password resets, billing receipts, and personal data to prompt injections and leaked User-Agent headers. 

AliasFleet gives every agent its own isolated, programmable inbox backed by custom domains and instant webhook event streams.

- **Zero Gmail OAuth**: No expiring 7-day test credentials or broken token refresh loops.
- **Instant Push Webhooks**: Inbound emails arrive in sub-seconds with HMAC-SHA256 signatures. No slow polling.
- **Custom Domains**: Point your own domain MX to prevent signups from getting blocked by anti-bot filters.
- **Built-in OTP & Link Parsing**: Extract 4-digit, 6-digit, and 8-digit verification codes automatically.

---

## 1. Quickstart: Claude Desktop & Cursor (MCP)

Add `aliasfleet-mcp` to your `claude_desktop_config.json` (or Cursor MCP settings):

```json
{
  "mcpServers": {
    "aliasfleet": {
      "command": "npx",
      "args": ["-y", "aliasfleet-mcp"],
      "env": {
        "ALIASFLEET_API_KEY": "afp_your_api_key_here"
      }
    }
  }
}
```

### Available MCP Tools

Once installed, Claude or Cursor can autonomously call:

1. `aliasfleet_create_inbox`: Provision a new dedicated forwarding address with custom label, local-part prefix, or custom domain.
2. `aliasfleet_list_inboxes`: Retrieve active agent inboxes and their routing states.
3. `aliasfleet_setup_webhook`: Register an HTTPS endpoint for instant push notifications (`email.received`).
4. `aliasfleet_get_account_info`: Check API identity, plan tier, and available quotas.

---

## 2. Quickstart: Python (Browser-Use & Playwright)

Install the Python client:

```bash
pip install aliasfleet-agent
```

### Example: Automated Signup with OTP Extraction

```python
from aliasfleet_agent import AliasFleetAgentClient

# Initialize client (uses ALIASFLEET_API_KEY env or local simulation)
client = AliasFleetAgentClient()

# 1. Provision a dedicated forwarding address for this agent session
inbox = client.create_inbox(label="Autonomous Signup Task")
print(f"Agent using address: {inbox['email']}")

# 2. Fill the target signup form in Browser-Use or Playwright
# await page.fill('input[type="email"]', inbox['email'])

# 3. Extract OTP verification code from incoming email webhook payload
email_body = "Your verification PIN is: 849201"
otp_code = client.parse_otp(email_body)
print(f"Extracted OTP: {otp_code}") # 849201

# await page.fill('input[name="otp"]', otp_code)
```

---

## 3. Local Development & Simulation Mode

Don't have an API key yet? Run in zero-configuration simulation mode:

```bash
export ALIASFLEET_MOCK=true
npx aliasfleet-mcp
```

Simulation mode responds to all tool calls with in-memory addresses, allowing you to run automated eval benchmarks, CI/CD pipelines, and local Playwright runs without consuming live quota.

---

## Machine-Readable Reference

For AI models and coding agents, view [`llms.txt`](./llms.txt) for raw endpoint schemas, Bearer token contracts, and JSON payloads.

---

## Security & Verification

All webhook dispatches include `X-AliasFleet-Signature` with HMAC-SHA256 digests (`t=timestamp,v1=signature`). Validate signatures using constant-time digest comparison:

```python
is_valid = client.verify_webhook_signature(
    raw_body=request.body,
    signature_header=request.headers.get("X-AliasFleet-Signature"),
    secret="af_whsec_your_signing_secret"
)
```

---

## License

MIT License. Built by [AliasFleet](https://www.aliasfleet.com).
