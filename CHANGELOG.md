# Changelog

## 0.2.0

### Added
- Message > Send: new "Recipient Type" option (Numbers / Group). In Group mode, the "Group ID" field accepts either the `id` (`group.…`) or the `internal_id` of the group and normalizes it for `POST /v2/send`.
- Group > Get Many: list the groups of the sender number (`GET /v1/groups/{number}`), one item per group.
- Group ID field: "From List" mode loading the groups of the sender number.
- Unit tests (`npm test` / `make test`) and a `node` tooling service in `docker-compose.yaml` (`make install`, `make lint`, `make test`).

### Changed
- The Signal node now exposes Resource / Operation selectors (Message > Send). Existing workflows keep working unchanged and still send to numbers by default.

## 0.1.0

- Initial release: send messages with optional attachments, text modes (styled/normal), and notify self.
