#!/usr/bin/env node
// Dev convenience CLI around POST /api/dev/simulate-webhook — the supported way to move
// a stubbed message through delivered/read/failed, or inject an inbound message, without
// ever using a timer. Examples:
//   node scripts/simulateWebhook.js --event delivered --vendorMessageId stub-abc123
//   node scripts/simulateWebhook.js --event inbound --mobile 9876543210 --name "Test User" --text "hi"
import { config } from '../src/config/index.js'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      args[key] = argv[i + 1]
      i += 1
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.event) {
    console.error('Usage: --event <delivered|read|failed|inbound> [--vendorMessageId ...] [--mobile ... --name ... --text ...]')
    process.exit(1)
  }

  const body = { event: args.event }
  if (args.vendorMessageId) body.vendorMessageId = args.vendorMessageId
  if (args.failedReason) body.failedReason = args.failedReason
  if (args.event === 'inbound') {
    body.contact = { mobile: args.mobile, countryCode: args.countryCode || '91', name: args.name }
    body.message = { type: args.type || 'text', text: args.text }
  }

  const response = await fetch(`http://localhost:${config.port}/api/dev/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  console.log(response.status, await response.text())
}

main()