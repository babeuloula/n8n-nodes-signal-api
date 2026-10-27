// Unit tests run with node:test and are not shipped in the package
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IDataObject } from 'n8n-workflow';
import { toInternalGroupId } from '../nodes/Signal/GroupId';
import { extractEnvelopes, matchesFilters, normalizeEnvelope } from '../nodes/SignalTrigger/normalize';

const ACCOUNT = '+33600000000';
const GROUP_INTERNAL_ID = 'AcAiyElQIeUVAmlTC1km6h8BCeKO1LgWsjHnzUdpoaM=';
const GROUP_ID = 'group.QWNBaXlFbFFJZVVWQW1sVEMxa202aDhCQ2VLTzFMZ1dzakhuelVkcG9hTT0=';

const sender = {
	source: '+33611111111',
	sourceNumber: '+33611111111',
	sourceUuid: '0c3a1c2e-0000-4000-8000-000000000001',
	sourceName: 'Alice',
	sourceDevice: 1,
	timestamp: 1760000000000,
};

const groupDataMessage: IDataObject = {
	...sender,
	dataMessage: {
		timestamp: 1760000000000,
		message: 'https://example.com',
		expiresInSeconds: 0,
		viewOnce: false,
		groupInfo: { groupId: GROUP_INTERNAL_ID, groupName: 'Liens', revision: 3, type: 'DELIVER' },
	},
};

const directDataMessage: IDataObject = {
	...sender,
	dataMessage: { timestamp: 1760000000001, message: 'hello', expiresInSeconds: 0, viewOnce: false },
};

const syncSentGroupMessage: IDataObject = {
	source: ACCOUNT,
	sourceNumber: ACCOUNT,
	sourceUuid: '0c3a1c2e-0000-4000-8000-000000000000',
	sourceName: 'Me',
	sourceDevice: 1,
	timestamp: 1760000000002,
	syncMessage: {
		sentMessage: {
			destination: null,
			destinationNumber: null,
			timestamp: 1760000000002,
			message: 'https://example.org',
			expiresInSeconds: 0,
			viewOnce: false,
			groupInfo: { groupId: GROUP_INTERNAL_ID, type: 'DELIVER' },
		},
	},
};

// Quote format from signal-cli (JsonQuote): id is the timestamp of the quoted message
const quote = {
	id: 1760000000000,
	author: '+33600000000',
	authorNumber: '+33600000000',
	authorUuid: '0c3a1c2e-0000-4000-8000-000000000000',
	text: 'Quel est le lien ?',
	attachments: [],
};

const groupReplyMessage: IDataObject = {
	...sender,
	timestamp: 1760000000010,
	dataMessage: {
		timestamp: 1760000000010,
		message: 'https://example.net',
		expiresInSeconds: 0,
		viewOnce: false,
		quote,
		groupInfo: { groupId: GROUP_INTERNAL_ID, groupName: 'Liens', revision: 3, type: 'DELIVER' },
	},
};

const syncReplyMessage: IDataObject = {
	...syncSentGroupMessage,
	syncMessage: {
		sentMessage: {
			destination: null,
			destinationNumber: null,
			timestamp: 1760000000011,
			message: 'Merci',
			expiresInSeconds: 0,
			viewOnce: false,
			quote: {
				id: 1760000000010,
				author: '0c3a1c2e-0000-4000-8000-000000000001',
				authorNumber: null,
				authorUuid: '0c3a1c2e-0000-4000-8000-000000000001',
				text: 'https://example.net',
				attachments: [],
			},
			groupInfo: { groupId: GROUP_INTERNAL_ID, type: 'DELIVER' },
		},
	},
};

const receiptMessage: IDataObject = {
	...sender,
	receiptMessage: { when: 1760000000003, isDelivery: false, isRead: true, isViewed: false, timestamps: [1760000000000] },
};

const typingMessage: IDataObject = {
	...sender,
	typingMessage: { action: 'STARTED', timestamp: 1760000000004, groupId: GROUP_INTERNAL_ID },
};

describe('extractEnvelopes', () => {
	it('reads the JSON-RPC notification posted to RECEIVE_WEBHOOK_URL', () => {
		const body = { jsonrpc: '2.0', method: 'receive', params: { envelope: groupDataMessage, account: ACCOUNT } };
		assert.deepEqual(extractEnvelopes(body), [{ envelope: groupDataMessage, account: ACCOUNT }]);
	});

	it('reads the format returned by GET /v1/receive (single item or array)', () => {
		const item = { envelope: directDataMessage, account: ACCOUNT };
		assert.deepEqual(extractEnvelopes(item), [item]);
		assert.deepEqual(extractEnvelopes([item, { envelope: receiptMessage, account: ACCOUNT }]).length, 2);
	});

	it('ignores payloads without envelope', () => {
		assert.deepEqual(extractEnvelopes({ jsonrpc: '2.0', id: '1', result: {} }), []);
		assert.deepEqual(extractEnvelopes(null), []);
		assert.deepEqual(extractEnvelopes('text'), []);
	});
});

describe('normalizeEnvelope', () => {
	it('normalizes a group dataMessage', () => {
		assert.deepEqual(normalizeEnvelope(groupDataMessage, ACCOUNT), {
			type: 'message',
			text: 'https://example.com',
			sourceNumber: '+33611111111',
			sourceName: 'Alice',
			sourceUuid: '0c3a1c2e-0000-4000-8000-000000000001',
			timestamp: 1760000000000,
			groupId: GROUP_INTERNAL_ID,
			groupName: 'Liens',
			isGroup: true,
			isFromMe: false,
			account: ACCOUNT,
			quotedTimestamp: null,
			quotedAuthor: null,
			quotedText: null,
		});
	});

	it('extracts the quote of a reply', () => {
		const message = normalizeEnvelope(groupReplyMessage, ACCOUNT);
		assert.equal(message.type, 'message');
		assert.equal(message.text, 'https://example.net');
		assert.equal(message.quotedTimestamp, '1760000000000');
		assert.equal(message.quotedAuthor, '+33600000000');
		assert.equal(message.quotedText, 'Quel est le lien ?');
	});

	it('extracts the quote of a reply sent from another device of the account', () => {
		const message = normalizeEnvelope(syncReplyMessage, ACCOUNT);
		assert.equal(message.type, 'sync');
		assert.equal(message.isFromMe, true);
		assert.equal(message.quotedTimestamp, '1760000000010');
		// No phone number known for the author: fall back to the UUID
		assert.equal(message.quotedAuthor, '0c3a1c2e-0000-4000-8000-000000000001');
		assert.equal(message.quotedText, 'https://example.net');
	});

	it('handles a quote without text (e.g. quoted attachment)', () => {
		const envelope = {
			...directDataMessage,
			dataMessage: { timestamp: 1, message: 'ok', quote: { id: 42, authorNumber: '+33611111111', text: null } },
		};
		const message = normalizeEnvelope(envelope, ACCOUNT);
		assert.equal(message.quotedTimestamp, '42');
		assert.equal(message.quotedText, null);
	});

	it('normalizes a direct dataMessage', () => {
		const message = normalizeEnvelope(directDataMessage, ACCOUNT);
		assert.equal(message.type, 'message');
		assert.equal(message.text, 'hello');
		assert.equal(message.groupId, null);
		assert.equal(message.isGroup, false);
		assert.equal(message.isFromMe, false);
		assert.equal(message.quotedTimestamp, null);
		assert.equal(message.quotedAuthor, null);
		assert.equal(message.quotedText, null);
	});

	it('normalizes a syncMessage.sentMessage sent from another device of the account', () => {
		const message = normalizeEnvelope(syncSentGroupMessage, ACCOUNT);
		assert.equal(message.type, 'sync');
		assert.equal(message.text, 'https://example.org');
		assert.equal(message.sourceNumber, ACCOUNT);
		assert.equal(message.timestamp, 1760000000002);
		assert.equal(message.groupId, GROUP_INTERNAL_ID);
		assert.equal(message.isGroup, true);
		assert.equal(message.isFromMe, true);
	});

	it('flags a dataMessage from the account number as own message', () => {
		const envelope = { ...directDataMessage, source: ACCOUNT, sourceNumber: ACCOUNT };
		assert.equal(normalizeEnvelope(envelope, ACCOUNT).isFromMe, true);
	});

	it('types receipts and typing indicators without text', () => {
		assert.equal(normalizeEnvelope(receiptMessage, ACCOUNT).type, 'receipt');
		assert.equal(normalizeEnvelope(receiptMessage, ACCOUNT).text, null);
		assert.equal(normalizeEnvelope(typingMessage, ACCOUNT).type, 'typing');
		assert.equal(normalizeEnvelope(typingMessage, ACCOUNT).isGroup, false);
	});
});

describe('matchesFilters', () => {
	const all = [groupDataMessage, directDataMessage, syncSentGroupMessage, receiptMessage, typingMessage].map((e) =>
		normalizeEnvelope(e, ACCOUNT),
	);
	const texts = (options: Parameters<typeof matchesFilters>[1]) =>
		all.filter((m) => matchesFilters(m, options)).map((m) => m.type + ':' + m.text);

	it('keeps everything without options', () => {
		assert.equal(texts({}).length, 5);
	});

	it('keeps only text messages', () => {
		assert.deepEqual(texts({ textOnly: true }), [
			'message:https://example.com',
			'message:hello',
			'sync:https://example.org',
		]);
	});

	it('ignores own messages', () => {
		assert.deepEqual(texts({ textOnly: true, ignoreOwnMessages: true }), [
			'message:https://example.com',
			'message:hello',
		]);
	});

	it('keeps only the given group, whatever the id format', () => {
		const expected = ['message:https://example.com', 'sync:https://example.org'];
		assert.deepEqual(texts({ textOnly: true, groupId: toInternalGroupId(GROUP_ID) }), expected);
		assert.deepEqual(texts({ textOnly: true, groupId: toInternalGroupId(GROUP_INTERNAL_ID) }), expected);
	});
});
