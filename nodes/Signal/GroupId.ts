// Group identifiers in signal-cli-rest-api come in two flavours:
// - `id` ("group.<base64>") is what the REST API expects in /v2/send recipients;
// - `internal_id` is the signal-cli group ID (base64 of 32 bytes), as found in
//   received messages under `groupInfo.groupId`.
// The REST API derives `id` as "group." + base64(internal_id).

const GROUP_PREFIX = 'group.';
const GROUP_ID_LENGTH = 32;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isValidInternalGroupId(internalId: string): boolean {
	return (
		internalId.length % 4 === 0 &&
		BASE64_PATTERN.test(internalId) &&
		Buffer.from(internalId, 'base64').length === GROUP_ID_LENGTH
	);
}

function invalidGroupId(input: string): Error {
	return new Error(
		`Invalid group ID "${input}": expected the "id" ("group.…") or the "internal_id" returned by GET /v1/groups/{number}`,
	);
}

export function toInternalGroupId(input: string): string {
	const value = input.trim();
	let internalId = value;

	if (value.startsWith(GROUP_PREFIX)) {
		const encoded = value.slice(GROUP_PREFIX.length);
		if (!BASE64_PATTERN.test(encoded)) {
			throw invalidGroupId(input);
		}
		internalId = Buffer.from(encoded, 'base64').toString('utf8');
	}

	if (!isValidInternalGroupId(internalId)) {
		throw invalidGroupId(input);
	}

	return internalId;
}

export function toSendGroupId(input: string): string {
	return GROUP_PREFIX + Buffer.from(toInternalGroupId(input), 'utf8').toString('base64');
}
