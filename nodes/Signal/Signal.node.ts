import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
	NodeOutput,
} from 'n8n-workflow';
import { type SignalContact, toContactOptions } from './Contact';
import { toSendGroupId } from './GroupId';
import { toList, toSendBatches } from './Recipients';
import { getSenderNumber, signalApiRequest } from './transport';

// Version 1.3 combines numbers, contacts and groups in a single message
const RECIPIENTS_COMBINED_VERSION = 1.3;

const showForMessageSend = {
	resource: ['message'],
	operation: ['send'],
};

const showForSend = {
	show: {
		...showForMessageSend,
		'@version': [{ _cnd: { gte: RECIPIENTS_COMBINED_VERSION } }],
	},
};

const showForLegacySend = {
	show: {
		...showForMessageSend,
		'@version': [1, 1.1, 1.2],
	},
};

const showForAnySend = {
	show: showForMessageSend,
};

const recipientNumbersField: INodeProperties = {
	displayName: 'Recipients Numbers',
	name: 'recipients',
	type: 'fixedCollection',
	default: {},
	description: 'Phone numbers of the recipients (with prefix)',
	placeholder: 'Add a recipient number',
	typeOptions: {
		multipleValues: true,
	},
	options: [
		{
			displayName: 'Recipient Number',
			name: 'recipient',
			values: [
				{
					displayName: 'Recipient',
					name: 'recipient',
					type: 'string',
					default: '',
					placeholder: '+33...',
					description: 'Phone number',
				},
			],
		},
	],
};

const contactsField: INodeProperties = {
	displayName: 'Contact Names or IDs',
	name: 'contacts',
	type: 'multiOptions',
	default: [],
	description:
		'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	hint: 'Contacts of the sender number. With an expression: numbers or UUIDs, as an array or a comma-separated list.',
	typeOptions: {
		loadOptionsMethod: 'getContacts',
		// Versions 1 and 1.1 have a "Sender Number" field
		loadOptionsDependsOn: ['number'],
	},
};

export class Signal implements INodeType {
	description: INodeTypeDescription = {
		defaults: {
			name: 'Send a Signal message',
		},
		description: 'Send a message with Signal API.',
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		group: ['transform'],
		// 'main' instead of NodeConnectionTypes.Main, which only exists since n8n 1.83:
		// referencing it makes older versions fail to load the node ("Class could not be found")
		// eslint-disable-next-line @n8n/community-nodes/node-connection-type-literal
		inputs: ['main'],
		// eslint-disable-next-line @n8n/community-nodes/node-connection-type-literal
		outputs: ['main'],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'message',
				options: [
					{
						name: 'Contact',
						value: 'contact',
					},
					{
						name: 'Group',
						value: 'group',
					},
					{
						name: 'Message',
						value: 'message',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'send',
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send',
						value: 'send',
						action: 'Send a message',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getAll',
				displayOptions: {
					show: {
						resource: ['group'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the groups of the sender number',
						action: 'Get many groups',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getAll',
				displayOptions: {
					show: {
						resource: ['contact'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the contacts of the sender number',
						action: 'Get many contacts',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'contactOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['getAll'],
					},
				},
				options: [
					{
						displayName: 'All Recipients',
						name: 'allRecipients',
						type: 'boolean',
						default: false,
						description:
							'Whether to also return the recipients that are not in the contact list (e.g. members of groups)',
					},
				],
			},
			{
				displayName: 'Sender Number',
				name: 'number',
				type: 'string',
				default: undefined,
				required: true,
				description: 'Phone number of the sender (with prefix)',
				placeholder: '+33...',
				// From version 1.2, the sender number is set in the credentials
				displayOptions: {
					show: {
						'@version': [1, 1.1],
					},
				},
			},
			// Versions 1 to 1.2: one type of recipient per message
			{
				displayName: 'Recipient Type',
				name: 'recipientType',
				type: 'options',
				default: 'numbers',
				displayOptions: showForLegacySend,
				options: [
					{
						name: 'Numbers',
						value: 'numbers',
						description: 'Send to one or more phone numbers',
					},
					{
						name: 'Contacts',
						value: 'contacts',
						description: 'Send to one or more contacts of the sender number',
					},
					{
						name: 'Group',
						value: 'group',
						description: 'Send to a Signal group',
					},
				],
			},
			{
				...contactsField,
				required: true,
				displayOptions: {
					show: {
						...showForLegacySend.show,
						recipientType: ['contacts'],
					},
				},
			},
			{
				...recipientNumbersField,
				required: true,
				displayOptions: {
					show: {
						...showForLegacySend.show,
						recipientType: ['numbers'],
					},
				},
			},
			{
				displayName: 'Group ID',
				name: 'groupId',
				type: 'resourceLocator',
				default: { mode: 'id', value: '' },
				required: true,
				description: 'Signal group to send the message to',
				displayOptions: {
					show: {
						...showForLegacySend.show,
						recipientType: ['group'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'group.… or internal_id',
						hint: 'Either the "id" or the "internal_id" of the group, as returned by Group > Get Many',
					},
				],
			},
			// From version 1.3: numbers, contacts and groups can be combined
			{
				...recipientNumbersField,
				displayOptions: showForSend,
			},
			{
				...contactsField,
				displayOptions: showForSend,
			},
			{
				displayName: 'Group Names or IDs',
				name: 'groupIds',
				type: 'multiOptions',
				default: [],
				displayOptions: showForSend,
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				hint: 'Groups of the sender number. With an expression: "id" (group.…) or "internal_id" of the groups, as an array or a comma-separated list.',
				typeOptions: {
					loadOptionsMethod: 'getGroups',
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: undefined,
				required: true,
				displayOptions: showForAnySend,
				description: 'Message to send',
			},
			{
				displayName: 'Text Mode',
				name: 'text_mode',
				type: 'options',
				default: 'styled',
				displayOptions: showForAnySend,
				options: [
					{
						name: 'Styled',
						value: 'styled',
					},
					{
						name: 'Normal',
						value: 'normal',
					},
				],
			},
			{
				displayName: 'Notify Self',
				name: 'notify_self',
				type: 'boolean',
				default: false,
				displayOptions: showForAnySend,
			},
			{
				displayName: 'Attachments',
				name: 'base64_attachments',
				type: 'fixedCollection',
				placeholder: 'Add an attachment',
				displayOptions: showForAnySend,
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						displayName: 'Attachment',
						name: 'attachment',
						values: [
							{
								displayName: 'Attachment',
								name: 'attachment',
								type: 'string',
								default: '',
								placeholder:
									'data:<MIME-TYPE>;filename=<FILENAME>;base64<comma><BASE64 ENCODED DATA>',
								description: 'Base64 encoded attachment',
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: showForAnySend,
				options: [
					{
						displayName: 'Quote Author',
						name: 'quoteAuthor',
						type: 'string',
						default: '',
						placeholder: '+33...',
						description:
							'Number or UUID of the author of the quoted message (e.g. sourceNumber from the Signal Trigger). Required with Quote Timestamp.',
					},
					{
						displayName: 'Quote Message',
						name: 'quoteMessage',
						type: 'string',
						default: '',
						description: 'Text of the quoted message, displayed in the quote',
					},
					{
						displayName: 'Quote Timestamp',
						name: 'quoteTimestamp',
						type: 'string',
						default: '',
						placeholder: '1760000000000',
						description:
							'Timestamp (ms) of the message to reply to (e.g. timestamp from the Signal Trigger). The message is sent as a reply quoting it.',
					},
				],
			},
		],
		// 1.1: Message > Send outputs one object per API result instead of the raw array
		// 1.2: the sender number is read from the credentials, the node field is removed
		// 1.3: numbers, contacts and groups can be combined in a message
		version: [1, 1.1, 1.2, 1.3],
		defaultVersion: 1.3,
		displayName: 'Signal',
		name: 'signal',
		icon: {
			light: 'file:../../icons/signal.svg',
			dark: 'file:../../icons/signal.dark.svg',
		},
		usableAsTool: true,
		credentials: [
			{
				name: 'signalApi',
				required: true,
			}
		],
	};

	methods = {
		loadOptions: {
			async getContacts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				let number: string;
				try {
					number = await getSenderNumber.call(this);
				} catch {
					return [];
				}

				return toContactOptions(await getContacts.call(this, number));
			},
			async getGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				let number: string;
				try {
					number = await getSenderNumber.call(this);
				} catch {
					return [];
				}

				return (await getGroups.call(this, number))
					.map((group) => ({
						name: (group.name as string) || (group.id as string),
						value: group.id as string,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
		listSearch: {
			async searchGroups(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				let number: string;
				try {
					number = await getSenderNumber.call(this);
				} catch {
					return { results: [] };
				}

				const groups = await getGroups.call(this, number);
				const search = (filter ?? '').toLowerCase();

				return {
					results: groups
						.filter((group) => !search || String(group.name ?? '').toLowerCase().includes(search))
						.map((group) => ({
							name: (group.name as string) || (group.id as string),
							value: group.id as string,
						})),
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<NodeOutput> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'message' && operation === 'send') {
					const response = await sendMessage.call(this, i);
					if (this.getNode().typeVersion >= 1.1 && Array.isArray(response)) {
						returnData.push(
							...(response as IDataObject[]).map((result) => ({ json: result, pairedItem: { item: i } })),
						);
					} else {
						// Version 1 kept the raw API response (an array) as is
						returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					}
				} else if (resource === 'group' && operation === 'getAll') {
					const number = await getSenderNumber.call(this, i);
					const groups = await getGroups.call(this, number);
					returnData.push(...groups.map((group) => ({ json: group, pairedItem: { item: i } })));
				} else if (resource === 'contact' && operation === 'getAll') {
					const number = await getSenderNumber.call(this, i);
					const { allRecipients } = this.getNodeParameter('contactOptions', i, {}) as {
						allRecipients?: boolean;
					};
					const contacts = await getContacts.call(this, number, allRecipients ?? false);
					returnData.push(
						...contacts.map((contact) => ({ json: contact as IDataObject, pairedItem: { item: i } })),
					);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${operation}" for resource "${resource}"`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function sendMessage(this: IExecuteFunctions, i: number): Promise<IDataObject | IDataObject[]> {
	const number = await getSenderNumber.call(this, i);
	const base64Attachments = this.getNodeParameter('base64_attachments.attachment', i, []) as Array<{ attachment: string }>;
	const textMode = this.getNodeParameter('text_mode', i) as string;
	const message = this.getNodeParameter('message', i) as string;
	const notifySelf = this.getNodeParameter('notify_self', i) as boolean;
	const options = this.getNodeParameter('options', i, {}) as {
		quoteTimestamp?: string | number;
		quoteAuthor?: string;
		quoteMessage?: string;
	};

	const body: IDataObject = {
		number: number,
		message: message,
		notify_self: notifySelf,
		text_mode: textMode,
		base64_attachments: base64Attachments.map(a => a.attachment),
	};

	const quoteTimestamp = String(options.quoteTimestamp ?? '').trim();
	if (quoteTimestamp !== '') {
		const quoteAuthor = (options.quoteAuthor ?? '').trim();
		if (!/^\d+$/.test(quoteTimestamp)) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid Quote Timestamp "${quoteTimestamp}": expected a timestamp in milliseconds`,
				{ itemIndex: i },
			);
		}
		if (quoteAuthor === '') {
			throw new NodeOperationError(this.getNode(), 'Quote Author is required with Quote Timestamp', {
				itemIndex: i,
			});
		}
		body.quote_timestamp = Number(quoteTimestamp);
		body.quote_author = quoteAuthor;
		if (options.quoteMessage) {
			body.quote_message = options.quoteMessage;
		}
	}

	if (this.getNode().typeVersion < RECIPIENTS_COMBINED_VERSION) {
		return await signalApiRequest.call(this, 'POST', '/v2/send', {
			...body,
			recipients: getLegacyRecipients.call(this, i),
		});
	}

	const numbers = this.getNodeParameter('recipients.recipient', i, []) as Array<{ recipient: string }>;
	const contacts = toList(this.getNodeParameter('contacts', i, []));
	const groups = toList(this.getNodeParameter('groupIds', i, []));

	let batches: string[][];
	try {
		batches = toSendBatches([...numbers.map((a) => a.recipient), ...contacts], groups);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
	}

	// The API accepts a single group per request, without numbers: one request per batch
	const results: IDataObject[] = [];
	for (const recipients of batches) {
		const response = await signalApiRequest.call(this, 'POST', '/v2/send', { ...body, recipients });
		const batchResults = (Array.isArray(response) ? response : [response]) as IDataObject[];
		results.push(...batchResults.map((result) => ({ ...result, recipients })));
	}

	return results;
}

// Versions 1 to 1.2: numbers, contacts or a single group
function getLegacyRecipients(this: IExecuteFunctions, i: number): string[] {
	const recipientType = this.getNodeParameter('recipientType', i) as string;
	if (recipientType === 'group') {
		const groupId = this.getNodeParameter('groupId', i, '', { extractValue: true }) as string;
		try {
			return [toSendGroupId(groupId)];
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
		}
	}

	if (recipientType === 'contacts') {
		const recipients = toList(this.getNodeParameter('contacts', i, []));
		if (recipients.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Select at least one contact', { itemIndex: i });
		}
		return recipients;
	}

	const numbers = this.getNodeParameter('recipients.recipient', i, []) as Array<{ recipient: string }>;
	return numbers.map(a => a.recipient);
}

async function getGroups(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	number: string,
): Promise<IDataObject[]> {
	const groups = await signalApiRequest.call(this, 'GET', `/v1/groups/${encodeURIComponent(number)}`);
	return Array.isArray(groups) ? groups : [];
}

async function getContacts(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	number: string,
	allRecipients = false,
): Promise<SignalContact[]> {
	const contacts = await signalApiRequest.call(
		this,
		'GET',
		`/v1/contacts/${encodeURIComponent(number)}`,
		undefined,
		allRecipients ? { all_recipients: true } : undefined,
	);
	return Array.isArray(contacts) ? contacts : [];
}
