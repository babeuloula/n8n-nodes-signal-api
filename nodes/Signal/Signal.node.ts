import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeOutput,
} from 'n8n-workflow';
import { toSendGroupId } from './GroupId';
import { signalApiRequest } from './transport';

const showForSend = {
	show: {
		resource: ['message'],
		operation: ['send'],
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
		inputs: ['main'],
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
				displayName: 'Sender Number',
				name: 'number',
				type: 'string',
				default: undefined,
				required: true,
				description: 'Phone number of the sender (with prefix)',
				placeholder: '+33...',
			},
			{
				displayName: 'Recipient Type',
				name: 'recipientType',
				type: 'options',
				default: 'numbers',
				displayOptions: showForSend,
				options: [
					{
						name: 'Numbers',
						value: 'numbers',
						description: 'Send to one or more phone numbers',
					},
					{
						name: 'Group',
						value: 'group',
						description: 'Send to a Signal group',
					},
				],
			},
			{
				displayName: 'Recipients Numbers',
				name: 'recipients',
				type: 'fixedCollection',
				default: {},
				required: true,
				displayOptions: {
					show: {
						...showForSend.show,
						recipientType: ['numbers'],
					},
				},
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
						...showForSend.show,
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
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: undefined,
				required: true,
				displayOptions: showForSend,
				description: 'Message to send',
			},
			{
				displayName: 'Text Mode',
				name: 'text_mode',
				type: 'options',
				default: 'styled',
				displayOptions: showForSend,
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
				displayOptions: showForSend,
			},
			{
				displayName: 'Attachments',
				name: 'base64_attachments',
				type: 'fixedCollection',
				placeholder: 'Add an attachment',
				displayOptions: showForSend,
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
		],
		version: 1,
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
		listSearch: {
			async searchGroups(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const number = this.getCurrentNodeParameter('number') as string;
				if (!number) {
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
					returnData.push({ json: response, pairedItem: { item: i } });
				} else if (resource === 'group' && operation === 'getAll') {
					const number = this.getNodeParameter('number', i) as string;
					const groups = await getGroups.call(this, number);
					returnData.push(...groups.map((group) => ({ json: group, pairedItem: { item: i } })));
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
				throw error;
			}
		}

		return [returnData];
	}
}

async function sendMessage(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const number = this.getNodeParameter('number', i) as string;
	const recipientType = this.getNodeParameter('recipientType', i) as string;
	const base64Attachments = this.getNodeParameter('base64_attachments.attachment', i, []) as Array<{ attachment: string }>;
	const textMode = this.getNodeParameter('text_mode', i) as string;
	const message = this.getNodeParameter('message', i) as string;
	const notifySelf = this.getNodeParameter('notify_self', i) as boolean;

	let recipients: string[];
	if (recipientType === 'group') {
		const groupId = this.getNodeParameter('groupId', i, '', { extractValue: true }) as string;
		try {
			recipients = [toSendGroupId(groupId)];
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
		}
	} else {
		const numbers = this.getNodeParameter('recipients.recipient', i, []) as Array<{ recipient: string }>;
		recipients = numbers.map(a => a.recipient);
	}

	const body = {
		number: number,
		recipients: recipients,
		message: message,
		notify_self: notifySelf,
		text_mode: textMode,
		base64_attachments: base64Attachments.map(a => a.attachment),
	};

	return await signalApiRequest.call(this, 'POST', '/v2/send', body);
}

async function getGroups(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	number: string,
): Promise<IDataObject[]> {
	const groups = await signalApiRequest.call(this, 'GET', `/v1/groups/${encodeURIComponent(number)}`);
	return Array.isArray(groups) ? groups : [];
}
