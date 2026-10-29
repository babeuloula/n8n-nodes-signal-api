# n8n node Signal API

This is a n8n community node. It lets you send messages to numbers and groups, and receive messages, via the [Signal CLI REST API](https://github.com/bbernhard/signal-cli-rest-api) in your n8n workflows.

Signal CLI REST API is an HTTP wrapper around signal-cli that lets you programmatically send Signal messages (including attachments), using a simple REST interface.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Receiving messages](#receiving-messages)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  
[Releasing](#releasing)  
[Version history](#version-history)

## Installation

Follow the official n8n guide to install community nodes: https://docs.n8n.io/integrations/community-nodes/installation/

In n8n, go to **Settings > Community Nodes > Install** and enter:

```
@babeuloula/n8n-nodes-signal-api
```

Updates are then available from the same screen.

> The unscoped package `n8n-nodes-signal-api` on npm is a different project, which targets another fork of signal-cli-rest-api. Do not install or update it in place of this one.

### Migrating from a manual install (`n8n-nodes-signal-api`)

Versions up to 0.3.0 were installed manually under the name `n8n-nodes-signal-api`. n8n identifies nodes by package name, so after installing `@babeuloula/n8n-nodes-signal-api`:
1. Remove the old `n8n-nodes-signal-api` folder from `~/.n8n/nodes/node_modules/` and restart n8n.
2. In your workflows, replace the Signal nodes, or export the workflow, replace `"type": "n8n-nodes-signal-api.` with `"type": "@babeuloula/n8n-nodes-signal-api.` and import it again.
3. Credentials are kept: the credential type (`signalApi`) does not change.

## Operations

### Message > Send

Send a Signal message to phone numbers, contacts and groups.

The message is sent from the Sender Number of the credentials.

Fields:
- Recipients Numbers (multiple): E.164 formatted recipient numbers.
- Contacts: pick contacts from the list (contacts of the Sender Number of the credentials, loaded from the API), or use an expression returning numbers or UUIDs, as an array or a comma-separated list.
- Groups: pick groups from the list (groups of the Sender Number of the credentials, loaded from the API), or use an expression returning group identifiers, as an array or a comma-separated list. Both formats are accepted, the node converts them to the format expected by the API:
  - the `id` returned by `GET /v1/groups/{number}` (`group.` followed by base64), for example `group.QWNBaXlF...`;
  - the `internal_id` (also found as `groupInfo.groupId` in received messages), for example `AcAiyElQ...=`.

Numbers, contacts and groups can be combined: set at least one recipient in any of these fields. Duplicates are removed. The API does not accept several groups, or groups and numbers, in the same request, so the node sends:
- one request for all the numbers and contacts;
- one request per group.

If a request fails, the following ones are not sent (the previous ones are already sent).

- Message (required): the message body to send.
- Text Mode: how the message text is processed by the API.
  - styled (default)
  - normal
- Notify Self: if enabled, the sender device will also be notified.
- Attachments: optional list of base64-encoded attachments.
  - Each attachment must be provided as a data URL in the form:
    `data:<MIME-TYPE>;filename=<FILENAME>;base64,<BASE64_ENCODED_DATA>`
- Options:
  - Quote Timestamp: timestamp (ms) of the message to reply to. The message is sent as a reply quoting it (`quote_timestamp`).
  - Quote Author: number or UUID of the author of the quoted message (`quote_author`). Required with Quote Timestamp.
  - Quote Message: text of the quoted message, displayed in the quote (`quote_message`).

Output: one item per result returned by the API, with the `recipients` of the request it belongs to, for example `{ "timestamp": "1760000000999", "recipients": ["+33600000001", "+33600000002"] }`. With groups, there is one item per group, the recipient being the `id` of the group.

Compatibility:
- Workflows created with 0.1.x keep working unchanged: they send to numbers.
- Signal nodes added before 0.3.0 (node version 1) keep returning the raw API response, an array: `[{ "timestamp": "…" }]`. Nodes added from 0.3.0 (node version 1.1) return an object. To switch an existing node to the new output, delete it and add it again.
- Signal nodes added before the Sender Number moved to the credentials (node versions 1 and 1.1) keep their "Sender Number" field. When it is empty, the Sender Number of the credentials is used. Newer nodes (version 1.2) only use the credentials.
- Signal nodes added before 0.5.0 (node versions 1 to 1.2) keep the "Recipient Type" selector: either Recipients Numbers, Contacts or a single Group ID ("From List" or "By ID"), and output the API results without `recipients`. Nodes added from 0.5.0 (node version 1.3) combine the recipients. To combine numbers, contacts and groups in an existing node, delete it and add it again.

### Group > Get Many

List the Signal groups of the Sender Number of the credentials (`GET /v1/groups/{number}`). The node returns one item per group, with the fields returned by the API, including:
- `id`: identifier to use in the Groups field of Message > Send (`group.…`);
- `internal_id`: identifier found in received messages (`groupInfo.groupId`);
- `name`, `description`, `members`, `admins`, `blocked`, `invite_link`, …

Use it once to find the identifier of the group to use in your workflow.

### Contact > Get Many

List the contacts of the Sender Number of the credentials (`GET /v1/contacts/{number}`). The node returns one item per contact, with the fields returned by the API, including `number`, `uuid`, `name`, `profile_name`, `username`, `blocked`, …

Options:
- All Recipients (default: off): also return the recipients that are not in the contact list, for example members of your groups (`all_recipients`).

### Signal Trigger

Starts the workflow when a message is received. signal-cli-rest-api pushes every received message to the URL set in its `RECEIVE_WEBHOOK_URL` environment variable (see [Receiving messages](#receiving-messages)).

Each message is output as one item:

| Field | Description |
| --- | --- |
| `type` | `message` (received), `sync` (sent from another device of your account), `receipt`, `typing` or `other` |
| `text` | Message text (`null` if none) |
| `sourceNumber`, `sourceName`, `sourceUuid` | Sender |
| `timestamp` | Message timestamp (ms) |
| `groupId` | `internal_id` of the group, `null` for a direct message |
| `groupName` | Group name, when provided by signal-cli |
| `isGroup` | `true` if the message was posted in a group |
| `isFromMe` | `true` if the message was sent by your own account (e.g. from your phone when signal-cli is a linked device: `syncMessage.sentMessage`) |
| `account` | Number of the signal-cli account that received the message |
| `quotedTimestamp` | When the message is a reply: timestamp (ms, as a string) of the quoted message, `null` otherwise |
| `quotedAuthor` | When the message is a reply: number (or UUID if the number is unknown) of the author of the quoted message, `null` otherwise |
| `quotedText` | When the message is a reply: text of the quoted message, `null` otherwise or if it has no text |

Parameters:
- Path (default: `signal`): path of the webhook URL, which becomes `<n8n URL>/webhook/<path>` (no generated ID). It must be unique across active workflows.

Options:
- Group ID: only keep messages from this group. Accepts the `id` (`group.…`) or the `internal_id`.
- Text Messages Only (default: on): ignore read receipts, typing indicators, reactions and other messages without text.
- Ignore My Own Messages (default: off): ignore messages sent by your own account.
- Include Raw Envelope (default: off): add the raw envelope received from signal-cli as `rawEnvelope`, for debugging.

The `groupId` output by the trigger can be used as is in the Groups field of Message > Send (Group ID in node versions 1 to 1.2) to reply in the same group: the node converts it.

To reply by quoting the received message, set in Message > Send:
- Groups: `{{ $json.groupId }}`
- Quote Timestamp: `{{ $json.timestamp }}`
- Quote Author: `{{ $json.sourceNumber }}`
- Quote Message: `{{ $json.text }}`

To know which message a received reply answers, compare `quotedTimestamp` with the `timestamp` returned when your message was sent.

## Receiving messages

The Signal Trigger relies on the webhook of signal-cli-rest-api, which is only available in `json-rpc` mode (`json-rpc-native` works too):
- set `MODE=json-rpc`;
- set `RECEIVE_WEBHOOK_URL` to the webhook URL of the Signal Trigger node (`<n8n URL>/webhook/<path>`, for example `http://n8n:5678/webhook/signal`).

Example `docker-compose.yaml`:

```yaml
services:
    signal-cli-rest-api:
        image: bbernhard/signal-cli-rest-api:0.101
        restart: unless-stopped
        environment:
            - MODE=json-rpc
            # Production URL of the Signal Trigger node (n8n reachable as "n8n" on the same Docker network)
            - RECEIVE_WEBHOOK_URL=http://n8n:5678/webhook/signal
        volumes:
            - ./signal-cli-config:/home/.local/share/signal-cli
        ports:
            - "127.0.0.1:8080:8080"
```

Notes:
- Only one URL can be configured. Use the production URL (workflow active); to test in the editor, temporarily switch it to the test URL (`/webhook-test/<path>`) and click "Listen for test event".
- `RECEIVE_WEBHOOK_URL` is ignored (the container stops with an error) in `normal` and `native` modes. In `json-rpc` mode, `GET /v1/receive/{number}` becomes a WebSocket and can't be polled.
- signal-cli-rest-api does not retry: messages received while n8n is down are not delivered again.
- The webhook is called without authentication: keep the n8n webhook URL private.

## Credentials

Prerequisites:
- A running instance of the Signal CLI REST API server (for example, via Docker). See the project documentation below.
- The API must be reachable from your n8n instance and protected with basic authentication.

Create credentials in n8n:
1. Go to Credentials and create new “Signal API” credentials.
2. Base URL: the base URL of your Signal CLI REST API (without trailing slash), for example `http://localhost:8080`.
3. User and Password: basic auth credentials configured on your API server.
4. Sender Number: E.164 formatted phone number of the signal-cli account used to send messages and list groups and contacts (for example, +33...).
5. Use the “Test” button; the node performs a GET request to `<baseUrl>/v1/about` to verify connectivity.

These credentials are then selected on the Signal node.

## Compatibility

- n8n Nodes API version: 1 (strict mode enabled).
- Tested with n8n 1.80 and 2.43. It should work with any n8n release from 1.80 onwards. If you encounter issues, please open an issue.

## Usage

Basic usage:
1. Add the “Signal” node to your workflow.
2. Select your “Signal API” credentials (the Sender Number is set there).
3. Add the recipients: Recipients Numbers, Contacts and/or Groups.
4. Write your Message.
5. Optionally, choose Text Mode, toggle Notify Self, and add Attachments.
6. Execute the node.

Group from a previous node (expression in the Groups field):
- `{{ $("Finaliser").first().json.groupId }}`

Attachment example:
- PNG image: `data:image/png;filename=screenshot.png;base64,<base64>`
- PDF: `data:application/pdf;filename=file.pdf;base64,<base64>`

Tips:
- Provide numbers in full international format (E.164).
- You can map values from previous nodes using n8n expressions for dynamic messages, recipients, or attachments.

## Resources

- n8n community nodes documentation: https://docs.n8n.io/integrations/#community-nodes
- Signal CLI REST API (project): https://github.com/bbernhard/signal-cli-rest-api
- Signal CLI REST API (Swagger): https://bbernhard.github.io/signal-cli-rest-api/#/General/get_v1_about
- This package repository: https://github.com/babeuloula/n8n-nodes-signal-api
- Signal Private Messenger: https://signal.org/

## Releasing

Releases are published to npm by GitHub Actions (`.github/workflows/publish.yml`) when a version tag is pushed, with an npm provenance statement (required by n8n for verified community nodes). The tag is the source of truth for the version.

One-time setup:
- npm authentication: either a Trusted Publisher on npmjs.com (package settings > Trusted Publishers > GitHub Actions, repository `babeuloula/n8n-nodes-signal-api`, workflow `publish.yml`), or a Granular Access Token (read and write, "bypass 2FA" enabled) stored in the `NPM_TOKEN` secret of the repository.
- If `main` is protected, allow GitHub Actions to push to it (the workflow commits the version bump).

While developing, add the changes under `## Unreleased` in `CHANGELOG.md`.

To release, tag the last commit of `main` (no `v` prefix) and push the tag:

```bash
git pull
git tag 0.4.0
git push origin 0.4.0
```

The Publish workflow then:
1. checks that the tagged commit is on `main` and that the tag is the next patch, minor or major version (a typo such as `3.0.0` instead of `0.3.0` is rejected);
2. sets the version in `package.json` and `package-lock.json`, and renames `## Unreleased` to `## 0.4.0` in `CHANGELOG.md` (if the section is empty, it lists the commits since the previous tag);
3. runs the tests, the lint and the build, and publishes to npm;
4. commits these changes on `main` (`chore(release): 0.4.0`). Run `git pull` afterwards.

If a run fails before publishing, fix the issue on `main`, then move the tag and push it again:

```bash
git tag -f 0.4.0 && git push -f origin 0.4.0
```

## Version history

See [CHANGELOG.md](CHANGELOG.md).


