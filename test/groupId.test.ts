// Unit tests run with node:test and are not shipped in the package
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toInternalGroupId, toSendGroupId } from '../nodes/Signal/GroupId';

// Same pair as returned by GET /v1/groups/{number}: id = "group." + base64(internal_id)
const INTERNAL_ID = 'AcAiyElQIeUVAmlTC1km6h8BCeKO1LgWsjHnzUdpoaM=';
const ID = 'group.QWNBaXlFbFFJZVVWQW1sVEMxa202aDhCQ2VLTzFMZ1dzakhuelVkcG9hTT0=';

describe('toSendGroupId', () => {
	it('converts an internal_id to the id expected by /v2/send', () => {
		assert.equal(toSendGroupId(INTERNAL_ID), ID);
	});

	it('keeps an id that is already prefixed', () => {
		assert.equal(toSendGroupId(ID), ID);
	});

	it('trims surrounding whitespace', () => {
		assert.equal(toSendGroupId(`  ${INTERNAL_ID}\n`), ID);
		assert.equal(toSendGroupId(` ${ID} `), ID);
	});

	it('rejects invalid identifiers', () => {
		for (const input of ['', 'group.', 'my group', '+33612345678', 'group.abc', 'YWJj', `${INTERNAL_ID}x`]) {
			assert.throws(() => toSendGroupId(input), /Invalid group ID/, input);
		}
	});
});

describe('toInternalGroupId', () => {
	it('converts an id to the internal_id found in received messages', () => {
		assert.equal(toInternalGroupId(ID), INTERNAL_ID);
	});

	it('keeps an internal_id unchanged', () => {
		assert.equal(toInternalGroupId(INTERNAL_ID), INTERNAL_ID);
	});

	it('round-trips', () => {
		assert.equal(toInternalGroupId(toSendGroupId(INTERNAL_ID)), INTERNAL_ID);
	});

	it('rejects a prefixed id that does not wrap a valid internal_id', () => {
		assert.throws(() => toInternalGroupId('group.' + Buffer.from('short').toString('base64')), /Invalid group ID/);
	});
});
