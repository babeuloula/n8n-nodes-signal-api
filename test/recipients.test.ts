// Unit tests run with node:test and are not shipped in the package
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toList, toSendBatches } from '../nodes/Signal/Recipients';

// Same pair as in groupId.test.ts
const INTERNAL_ID = 'AcAiyElQIeUVAmlTC1km6h8BCeKO1LgWsjHnzUdpoaM=';
const ID = 'group.QWNBaXlFbFFJZVVWQW1sVEMxa202aDhCQ2VLTzFMZ1dzakhuelVkcG9hTT0=';
const OTHER_INTERNAL_ID = Buffer.alloc(32, 1).toString('base64');
const OTHER_ID = 'group.' + Buffer.from(OTHER_INTERNAL_ID, 'utf8').toString('base64');

describe('toList', () => {
	it('keeps an array, trimmed and without empty values', () => {
		assert.deepEqual(toList([' +33600000001 ', '', '+33600000002']), ['+33600000001', '+33600000002']);
	});

	it('splits a comma-separated list', () => {
		assert.deepEqual(toList('+33600000001, +33600000002,'), ['+33600000001', '+33600000002']);
	});

	it('returns an empty list for an empty value', () => {
		assert.deepEqual(toList(undefined), []);
		assert.deepEqual(toList(''), []);
	});
});

describe('toSendBatches', () => {
	it('sends numbers and contacts in a single request', () => {
		assert.deepEqual(toSendBatches(['+33600000001', '+33600000002'], []), [['+33600000001', '+33600000002']]);
	});

	it('sends each group in its own request, after the individual recipients', () => {
		assert.deepEqual(toSendBatches(['+33600000001'], [ID, OTHER_INTERNAL_ID]), [
			['+33600000001'],
			[ID],
			[OTHER_ID],
		]);
	});

	it('sends to groups only', () => {
		assert.deepEqual(toSendBatches([], [INTERNAL_ID]), [[ID]]);
	});

	it('removes duplicates, including a group given by id and internal_id', () => {
		assert.deepEqual(toSendBatches(['+33600000001', ' +33600000001'], [ID, INTERNAL_ID]), [
			['+33600000001'],
			[ID],
		]);
	});

	it('rejects an invalid group ID', () => {
		assert.throws(() => toSendBatches([], ['not-a-group']), /Invalid group ID/);
	});

	it('rejects a message without recipient', () => {
		assert.throws(() => toSendBatches(['', ' '], ['']), /No recipient/);
	});
});
