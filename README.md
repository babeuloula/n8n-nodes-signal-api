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
[Version history](#version-history)

## Installation

Follow the official n8n guide to install community nodes: https://docs.n8n.io/integrations/community-nodes/installation/

Package name: `n8n-nodes-signal-api`

## Operations

### Message > Send

Send a Signal message to phone numbers or to a group.

Fields:
- Sender Number (required): E.164 formatted phone number of the sender (for example, +33...).
- Recipient Type: who receives the message.
  - Numbers (default): one or more phone numbers.
  - Group: a Signal group.
- Recipients Numbers (required for Numbers, multiple): one or more E.164 formatted recipient numbers.
- Group ID (required for Group): pick the group "From List" (groups of the Sender Number, loaded from the API) or enter it "By ID" (expressions supported). Both formats are accepted by ID, the node converts it to the format expected by the API:
  - the `id` returned by `GET /v1/groups/{number}` (`group.` followed by base64), for example `group.QWNBaXlF...`;
  - the `internal_id` (also found as `groupInfo.groupId` in received messages), for example `AcAiyElQ...=`.
- Message (required): the message body to send.
- Text Mode: how the message text is processed by the API.
  - styled (default)
  - normal
- Notify Self: if enabled, the sender device will also be notified.
- Attachments: optional list of base64-encoded attachments.
  - Each attachment must be provided as a data URL in the form:
    `data:<MIME-TYPE>;filename=<FILENAME>;base64,<BASE64_ENCODED_DATA>`

The node returns the JSON response from the Signal CLI REST API for each input item.

Workflows created with 0.1.x keep working unchanged: they send to numbers.

### Group > Get Many

List the Signal groups of the Sender Number (`GET /v1/groups/{number}`). The node returns one item per group, with the fields returned by the API, including:
- `id`: identifier to use in Message > Send (`group.…`);
- `internal_id`: identifier found in received messages (`groupInfo.groupId`);
- `name`, `description`, `members`, `admins`, `blocked`, `invite_link`, …

Use it once to find the identifier of the group to use in your workflow.

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

Options:
- Group ID: only keep messages from this group. Accepts the `id` (`group.…`) or the `internal_id`.
- Text Messages Only (default: on): ignore read receipts, typing indicators, reactions and other messages without text.
- Ignore My Own Messages (default: off): ignore messages sent by your own account.
- Include Raw Envelope (default: off): add the raw envelope received from signal-cli as `rawEnvelope`, for debugging.

The `groupId` output by the trigger can be used as is in the Group ID field of Message > Send to reply in the same group: the node converts it.

## Receiving messages

The Signal Trigger relies on the webhook of signal-cli-rest-api, which is only available in `json-rpc` mode (`json-rpc-native` works too):
- set `MODE=json-rpc`;
- set `RECEIVE_WEBHOOK_URL` to the webhook URL of the Signal Trigger node (shown in the node, for example `http://n8n:5678/webhook/<id>/webhook`).

Example `docker-compose.yaml`:

```yaml
services:
    signal-cli-rest-api:
        image: bbernhard/signal-cli-rest-api:0.101
        restart: unless-stopped
        environment:
            - MODE=json-rpc
            # Production URL of the Signal Trigger node (n8n reachable as "n8n" on the same Docker network)
            - RECEIVE_WEBHOOK_URL=http://n8n:5678/webhook/<webhook-id>/webhook
        volumes:
            - ./signal-cli-config:/home/.local/share/signal-cli
        ports:
            - "127.0.0.1:8080:8080"
```

Notes:
- Only one URL can be configured. Use the production URL (workflow active); to test in the editor, temporarily switch it to the test URL (`/webhook-test/...`) and click "Listen for test event".
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
4. Use the “Test” button; the node performs a GET request to `<baseUrl>/v1/about` to verify connectivity.

These credentials are then selected on the Signal node.

## Compatibility

- n8n Nodes API version: 1 (strict mode enabled).
- Tested with recent n8n 1.x versions. It should work with any modern 1.x release. If you encounter issues on older versions, please open an issue.

## Usage

Basic usage:
1. Add the “Signal” node to your workflow.
2. Select your “Signal API” credentials.
3. Enter the Sender Number (with country prefix, e.g. +33...).
4. Choose the Recipient Type: add one or more Recipients Numbers, or set the Group ID.
5. Write your Message.
6. Optionally, choose Text Mode, toggle Notify Self, and add Attachments.
7. Execute the node.

Group ID from a previous node (expression):
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

## Version history

- 0.2.0 — Send messages to Signal groups, list groups, Signal Trigger.
- 0.1.0 — Initial release: send messages with optional attachments, text modes (styled/normal), and notify self.


