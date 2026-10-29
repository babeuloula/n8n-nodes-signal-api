// Contacts as returned by GET /v1/contacts/{number}. A contact has a `number`
// and/or a `uuid` (the number can be hidden by its owner), both accepted as
// recipients by /v2/send.

export interface SignalContact {
	number?: string;
	uuid?: string;
	name?: string;
	profile_name?: string;
	username?: string;
	[key: string]: unknown;
}

export interface ContactOption {
	name: string;
	value: string;
	description?: string;
}

// Recipient to use in /v2/send, empty if the contact has neither number nor UUID
export function toContactRecipient(contact: SignalContact): string {
	return (contact.number || contact.uuid || '').trim();
}

export function toContactOption(contact: SignalContact): ContactOption | null {
	const value = toContactRecipient(contact);
	if (!value) {
		return null;
	}

	const name = (contact.name || contact.profile_name || contact.username || '').trim();

	return name ? { name, value, description: value } : { name: value, value };
}

export function toContactOptions(contacts: SignalContact[]): ContactOption[] {
	return contacts
		.map(toContactOption)
		.filter((option): option is ContactOption => option !== null)
		.sort((a, b) => a.name.localeCompare(b.name));
}
