import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	NodeOutput,
} from 'n8n-workflow';
import { IHttpRequestOptions } from 'n8n-workflow/dist/esm/interfaces';

export class Signal implements INodeType {
	description: INodeTypeDescription = {
		defaults: {
			name: 'Send a Signal message',
		},
		description: 'Send a message with Signal API.',
		group: ['transform'],
		inputs: ['main'],
		outputs: ['main'],
		properties: [
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
				displayName: 'Recipients Numbers',
				name: 'recipients',
				type: 'fixedCollection',
				default: {},
				required: true,
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
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: undefined,
				required: true,
				description: 'Message to send',
			},
			{
				displayName: 'Text Mode',
				name: 'text_mode',
				type: 'options',
				default: 'styled',
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
			},
			{
				displayName: 'Attachments',
				name: 'base64_attachments',
				type: 'fixedCollection',
				placeholder: 'Add an attachment',
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

	async execute?(this: IExecuteFunctions): Promise<NodeOutput> {
		const items = this.getInputData();
		const returnData = [];

		const credentials = await this.getCredentials('signalApi');
		const baseUrl = credentials.baseUrl as string;
		const username = credentials.username as string;
		const password = credentials.password as string;

		for (let i = 0; i < items.length; i++) {
			const number = this.getNodeParameter('number', i) as string;
			const base64Attachments = this.getNodeParameter('base64_attachments.attachment', i, []) as Array<{ attachment: string }>;
			const recipients = this.getNodeParameter('recipients.recipient', i, []) as Array<{ recipient: string }>;
			const textMode = this.getNodeParameter('text_mode', i) as string;
			const message = this.getNodeParameter('message', i) as string;
			const notifySelf = this.getNodeParameter('notify_self', i) as boolean;

			const body = {
				number: number,
				recipients: recipients.map(a => a.recipient),
				message: message,
				notify_self: notifySelf,
				text_mode: textMode,
				base64_attachments: base64Attachments.map(a => a.attachment),
			};

			const options: IHttpRequestOptions = {
				url: baseUrl + '/v2/send',
				method: 'POST',
				auth: {
					username,
					password,
					sendImmediately: true,
				},
				headers: {
					'Content-Type': 'application/json',
				},
				json: true,
				body: body,
			};

			const response = await this.helpers.httpRequest(options);

			returnData.push({ json: response });
		}

		return [this.helpers.returnJsonArray(returnData)];
	};
}
