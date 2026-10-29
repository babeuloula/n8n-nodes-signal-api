// POST /v2/send accepts either individual recipients (numbers, UUIDs) or a single
// group per request: groups and numbers can't be mixed, nor several groups. A
// message to numbers, contacts and groups is split into one request for the
// individual recipients and one request per group.

import { toSendGroupId } from './GroupId';

// Values of a multiOptions field: an array, or a comma-separated list when set
// with an expression
export function toList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}

	return (Array.isArray(value) ? value : String(value).split(','))
		.map((item) => String(item).trim())
		.filter((item) => item !== '');
}

export function toSendBatches(individuals: string[], groups: string[]): string[][] {
	const batches: string[][] = [];

	const uniqueIndividuals = [...new Set(individuals.map((recipient) => recipient.trim()))].filter(
		(recipient) => recipient !== '',
	);
	if (uniqueIndividuals.length > 0) {
		batches.push(uniqueIndividuals);
	}

	// The "id" and the "internal_id" of a group give the same send ID
	const uniqueGroups = [...new Set(groups.filter((group) => group.trim() !== '').map(toSendGroupId))];
	batches.push(...uniqueGroups.map((group) => [group]));

	if (batches.length === 0) {
		throw new Error('No recipient: add at least one number, contact or group');
	}

	return batches;
}
