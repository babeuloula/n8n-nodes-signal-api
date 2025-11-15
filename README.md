# n8n node Signal API

This is a n8n community node. It lets you send messages via the [Signal CLI REST API](https://github.com/bbernhard/signal-cli-rest-api) in your n8n workflows.

Signal CLI REST API is an HTTP wrapper around signal-cli that lets you programmatically send Signal messages (including attachments), using a simple REST interface.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  
[Version history](#version-history)

## Installation

Follow the official n8n guide to install community nodes: https://docs.n8n.io/integrations/community-nodes/installation/

Package name: `n8n-nodes-signal-api`

## Operations

This node currently provides a single operation: send a Signal message.

Fields:
- Sender Number (required): E.164 formatted phone number of the sender (for example, +33...).
- Recipients Numbers (required, multiple): one or more E.164 formatted recipient numbers.
- Message (required): the message body to send.
- Text Mode: how the message text is processed by the API.
  - styled (default)
  - normal
- Notify Self: if enabled, the sender device will also be notified.
- Attachments: optional list of base64-encoded attachments.
  - Each attachment must be provided as a data URL in the form:
    `data:<MIME-TYPE>;filename=<FILENAME>;base64,<BASE64_ENCODED_DATA>`

The node returns the JSON response from the Signal CLI REST API for each input item.

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
4. Add one or more Recipients Numbers.
5. Write your Message.
6. Optionally, choose Text Mode, toggle Notify Self, and add Attachments.
7. Execute the node.

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

- 0.1.0 — Initial release: send messages with optional attachments, text modes (styled/normal), and notify self.


