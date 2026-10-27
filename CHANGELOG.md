# Changelog

## 0.3.0

### Added
- Signal Trigger: `quotedTimestamp` (string), `quotedAuthor` and `quotedText` when the message is a reply, read from `dataMessage.quote` or `syncMessage.sentMessage.quote` (`null` otherwise).
- Message > Send: options Quote Timestamp, Quote Author and Quote Message (`quote_timestamp`, `quote_author`, `quote_message`) to reply by quoting a message.

### Changed
- Signal node version 1.1: Message > Send outputs one object per API result (`{ timestamp }`) instead of the raw array (`[{ timestamp }]`). Existing nodes (version 1) keep the previous output.
- Package renamed to `@babeuloula/n8n-nodes-signal-api` and published on npm (the unscoped name belongs to another project). Node types change accordingly, see "Migrating from a manual install" in the README.
- API errors are reported as `NodeApiError`; requests use the credential authentication (`httpRequestWithAuthentication`).
- Tooling: `@n8n/node-cli` 0.54, GitHub Actions publish workflow with npm provenance, triggered by version tags.

## 0.2.0

### Added
- Message > Send: new "Recipient Type" option (Numbers / Group). In Group mode, the "Group ID" field accepts either the `id` (`group.…`) or the `internal_id` of the group and normalizes it for `POST /v2/send`.
- Group > Get Many: list the groups of the sender number (`GET /v1/groups/{number}`), one item per group.
- Group ID field: "From List" mode loading the groups of the sender number.
- Signal Trigger node: receives messages pushed by signal-cli-rest-api (`RECEIVE_WEBHOOK_URL`, json-rpc mode) on a configurable webhook path (`/webhook/signal` by default), and outputs one normalized item per message (`text`, `sourceNumber`, `sourceName`, `timestamp`, `groupId`, `isGroup`, `isFromMe`, …). Handles both `dataMessage` and `syncMessage.sentMessage`. Options: Group ID, Text Messages Only, Ignore My Own Messages, Include Raw Envelope.
- Unit tests (`npm test` / `make test`) and a `node` tooling service in `docker-compose.yaml` (`make install`, `make lint`, `make test`).

### Changed
- The Signal node now exposes Resource / Operation selectors (Message > Send). Existing workflows keep working unchanged and still send to numbers by default.

## 0.1.0

- Initial release: send messages with optional attachments, text modes (styled/normal), and notify self.
