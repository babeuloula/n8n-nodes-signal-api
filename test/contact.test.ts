// Unit tests run with node:test and are not shipped in the package
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toContactOption, toContactOptions, toContactRecipient } from '../nodes/Signal/Contact';

const UUID = '0f2a1b3c-4d5e-6f70-8192-a3b4c5d6e7f8';

describe('toContactRecipient', () => {
	it('prefers the number', () => {
		assert.equal(toContactRecipient({ number: '+33600000001', uuid: UUID }), '+33600000001');
	});

	it('falls back to the UUID when the number is hidden', () => {
		assert.equal(toContactRecipient({ number: '', uuid: UUID }), UUID);
	});

	it('is empty without number nor UUID', () => {
		assert.equal(toContactRecipient({ name: 'Alice' }), '');
	});
});

describe('toContactOption', () => {
	it('uses the contact name and shows the recipient as description', () => {
		assert.deepEqual(toContactOption({ number: '+33600000001', name: 'Alice', profile_name: 'Al' }), {
			name: 'Alice',
			value: '+33600000001',
			description: '+33600000001',
		});
	});

	it('falls back to the profile name, then the username', () => {
		assert.equal(toContactOption({ number: '+33600000001', profile_name: 'Al' })?.name, 'Al');
		assert.equal(toContactOption({ uuid: UUID, username: 'bob.42' })?.name, 'bob.42');
	});

	it('uses the recipient as name when the contact has no name', () => {
		assert.deepEqual(toContactOption({ number: '+33600000001' }), {
			name: '+33600000001',
			value: '+33600000001',
		});
	});

	it('ignores a contact without number nor UUID', () => {
		assert.equal(toContactOption({ name: 'Alice' }), null);
	});
});

describe('toContactOptions', () => {
	it('drops unusable contacts and sorts by name', () => {
		assert.deepEqual(
			toContactOptions([
				{ number: '+33600000002', name: 'Bob' },
				{ name: 'Nobody' },
				{ number: '+33600000001', name: 'Alice' },
			]).map((option) => option.name),
			['Alice', 'Bob'],
		);
	});
});
