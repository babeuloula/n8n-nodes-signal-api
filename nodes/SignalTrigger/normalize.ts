import type { IDataObject } from 'n8n-workflow';

export type SignalMessageType = 'message' | 'sync' | 'receipt' | 'typing' | 'other';

export interface SignalReceived {
	envelope: IDataObject;
	account: string | null;
}

export interface SignalMessage {
	type: SignalMessageType;
	text: string | null;
	sourceNumber: string | null;
	sourceName: string | null;
	sourceUuid: string | null;
	timestamp: number | null;
	groupId: string | null;
	groupName: string | null;
	isGroup: boolean;
	isFromMe: boolean;
	account: string | null;
}

function asObject(value: unknown): IDataObject | undefined {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as IDataObject)
		: undefined;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value !== '' ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === 'number' ? value : null;
}

// Accepts the JSON-RPC notification posted to RECEIVE_WEBHOOK_URL
// ({"jsonrpc":"2.0","method":"receive","params":{"envelope":…,"account":…}}),
// the items returned by GET /v1/receive/{number} ({"envelope":…,"account":…}),
// or an array of those.
export function extractEnvelopes(body: unknown): SignalReceived[] {
	if (Array.isArray(body)) {
		return body.flatMap((entry) => extractEnvelopes(entry));
	}

	const data = asObject(body);
	if (!data) {
		return [];
	}

	const payload = asObject(data.params) ?? data;
	const envelope = asObject(payload.envelope);
	if (!envelope) {
		return [];
	}

	return [{ envelope, account: asString(payload.account) }];
}

export function normalizeEnvelope(envelope: IDataObject, account: string | null): SignalMessage {
	const sourceNumber = asString(envelope.sourceNumber) ?? asString(envelope.source);

	// A message sent from another device of the account (signal-cli being a linked
	// device) arrives as syncMessage.sentMessage instead of dataMessage.
	const sentMessage = asObject(asObject(envelope.syncMessage)?.sentMessage);
	const dataMessage = asObject(envelope.dataMessage);
	const content = sentMessage ?? dataMessage;

	let type: SignalMessageType = 'other';
	if (sentMessage) {
		type = 'sync';
	} else if (dataMessage) {
		type = 'message';
	} else if (envelope.receiptMessage) {
		type = 'receipt';
	} else if (envelope.typingMessage) {
		type = 'typing';
	}

	const groupInfo = asObject(content?.groupInfo);
	const groupId = asString(groupInfo?.groupId);

	return {
		type,
		text: asString(content?.message),
		sourceNumber,
		sourceName: asString(envelope.sourceName),
		sourceUuid: asString(envelope.sourceUuid),
		timestamp: asNumber(content?.timestamp) ?? asNumber(envelope.timestamp),
		groupId,
		groupName: asString(groupInfo?.groupName),
		isGroup: groupId !== null,
		isFromMe: sentMessage !== undefined || (account !== null && sourceNumber === account),
		account,
	};
}

export interface FilterOptions {
	groupId?: string;
	textOnly?: boolean;
	ignoreOwnMessages?: boolean;
}

// `groupId` must already be an internal_id (see toInternalGroupId).
export function matchesFilters(message: SignalMessage, options: FilterOptions): boolean {
	if (options.textOnly && (message.text === null || (message.type !== 'message' && message.type !== 'sync'))) {
		return false;
	}
	if (options.ignoreOwnMessages && message.isFromMe) {
		return false;
	}
	if (options.groupId && message.groupId !== options.groupId) {
		return false;
	}
	return true;
}
