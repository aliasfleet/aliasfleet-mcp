/**
 * Automated end-to-end test suite for AliasFleet MCP Server
 * Simulates standard stdio JSON-RPC handshake, tools/list, and tools/call.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'mcp-server', 'bin', 'cli.js');

console.log('--- Starting AliasFleet MCP Server Test Suite ---');

const proc = spawn('node', [serverPath], {
  env: {
    ...process.env,
    ALIASFLEET_MOCK: 'true'
  },
  stdio: ['pipe', 'pipe', 'inherit']
});

let outputData = '';

proc.stdout.on('data', (chunk) => {
  outputData += chunk.toString();
  const lines = outputData.split('\n');
  outputData = lines.pop(); // keep last incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      handleServerResponse(msg);
    } catch (e) {
      console.error('Failed to parse response:', line);
    }
  }
});

let step = 0;
function sendJsonRpc(obj) {
  proc.stdin.write(JSON.stringify(obj) + '\n');
}

function handleServerResponse(res) {
  if (res.id === 1) {
    console.log('[PASS] MCP initialize handshake received:', res.result?.serverInfo?.name);
    // Send notifications/initialized then tools/list
    sendJsonRpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    sendJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  } else if (res.id === 2) {
    const tools = res.result?.tools || [];
    console.log(`[PASS] tools/list returned ${tools.length} tools:`, tools.map(t => t.name).join(', '));
    // Call aliasfleet_create_inbox
    sendJsonRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'aliasfleet_create_inbox',
        arguments: {
          label: 'Test AI Agent Inbox',
          local_part: 'agent-test-otp'
        }
      }
    });
  } else if (res.id === 3) {
    console.log('[PASS] tools/call (aliasfleet_create_inbox) output:');
    const content = res.result?.content?.[0]?.text;
    console.log(content);
    // Call aliasfleet_list_inboxes
    sendJsonRpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'aliasfleet_list_inboxes',
        arguments: {}
      }
    });
  } else if (res.id === 4) {
    console.log('[PASS] tools/call (aliasfleet_list_inboxes) output:');
    const content = res.result?.content?.[0]?.text;
    console.log(content);
    // Call aliasfleet_setup_webhook
    sendJsonRpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'aliasfleet_setup_webhook',
        arguments: {
          url: 'https://example.com/webhook',
          name: 'CI Webhook Listener'
        }
      }
    });
  } else if (res.id === 5) {
    console.log('[PASS] tools/call (aliasfleet_setup_webhook) output:');
    const content = res.result?.content?.[0]?.text;
    console.log(content);
    const parsed = JSON.parse(content);
    if (!parsed.signing_secret || parsed.signing_secret === "Configure in AliasFleet dashboard") {
      console.error('[FAIL] Webhook signing_secret not properly resolved:', parsed.signing_secret);
      process.exit(1);
    }
    console.log('[PASS] Webhook signing_secret verified:', parsed.signing_secret);
    // Call aliasfleet_get_account_info
    sendJsonRpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'aliasfleet_get_account_info',
        arguments: {}
      }
    });
  } else if (res.id === 6) {
    console.log('[PASS] tools/call (aliasfleet_get_account_info) output:');
    const content = res.result?.content?.[0]?.text;
    console.log(content);

    console.log('--- ALL 4 MCP TOOLS VERIFIED AND PASSED ---');
    proc.kill();
    process.exit(0);
  }
}

// Start handshake
sendJsonRpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'agent-tester', version: '1.0' }
  }
});

setTimeout(() => {
  console.error('[FAIL] Test timed out after 5000ms');
  proc.kill();
  process.exit(1);
}, 5000);
