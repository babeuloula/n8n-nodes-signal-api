import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { toInternalGroupId } from '../Signal/GroupId';
import { extractEnvelopes, matchesFilters, normalizeEnvelope } from './normalize';

// No webhookMethods: signal-cli-rest-api has no API to register a webhook, its URL is
// set once with the RECEIVE_WEBHOOK_URL environment variable (see README)
// eslint-disable-next-line @n8n/community-nodes/webhook-lifecycle-complete
export class SignalTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Signal Trigger',
		name: 'signalTrigger',
		subtitle: '={{"/webhook/" + $parameter["path"]}}',
		icon: {
			light: 'file:../../icons/signal.svg',
			dark: 'file:../../icons/signal.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when a Signal message is received by signal-cli-rest-api.',
		eventTriggerDescription: 'Waiting for a Signal message',
		activationMessage:
			'Signal messages will now trigger this workflow, as long as RECEIVE_WEBHOOK_URL points to the production URL of this node.',
		defaults: {
			name: 'Signal Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '={{$parameter["path"]}}',
				isFullPath: true,
			},
		],
		properties: [
			{
				displayName:
					'signal-cli-rest-api must run with <code>MODE=json-rpc</code> and <code>RECEIVE_WEBHOOK_URL</code> set to the webhook URL of this node. Only one URL can be configured: use the production URL, or switch it temporarily to the test URL.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: 'signal',
				placeholder: 'signal',
				required: true,
				description:
					'Path of the webhook URL, without leading slash: the URL becomes [n8n URL]/webhook/[path]. Must be unique across active workflows.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Group ID',
						name: 'groupId',
						type: 'string',
						default: '',
						placeholder: 'group.… or internal_id',
						description:
							'Only keep messages from this group (other conversations are ignored). Accepts the group ID ("group.…") or its internal ID.',
					},
					{
						displayName: 'Ignore My Own Messages',
						name: 'ignoreOwnMessages',
						type: 'boolean',
						default: false,
						description:
							'Whether to ignore messages sent by the account itself (e.g. from your phone when signal-cli is a linked device)',
					},
					{
						displayName: 'Include Raw Envelope',
						name: 'includeRawEnvelope',
						type: 'boolean',
						default: false,
						description: 'Whether to add the raw envelope received from signal-cli to each item, for debugging',
					},
					{
						displayName: 'Text Messages Only',
						name: 'textOnly',
						type: 'boolean',
						default: true,
						description:
							'Whether to ignore everything that is not a text message (read receipts, typing indicators, reactions, …)',
					},
				],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const options = this.getNodeParameter('options', {}) as {
			groupId?: string;
			ignoreOwnMessages?: boolean;
			includeRawEnvelope?: boolean;
			textOnly?: boolean;
		};

		let groupId: string | undefined;
		if (options.groupId?.trim()) {
			try {
				groupId = toInternalGroupId(options.groupId);
			} catch (error) {
				throw new NodeOperationError(this.getNode(), error.message);
			}
		}

		const items: INodeExecutionData[] = [];
		for (const { envelope, account } of extractEnvelopes(this.getBodyData())) {
			const message = normalizeEnvelope(envelope, account);
			if (
				!matchesFilters(message, {
					groupId,
					textOnly: options.textOnly ?? true,
					ignoreOwnMessages: options.ignoreOwnMessages ?? false,
				})
			) {
				continue;
			}

			const json: IDataObject = { ...message };
			if (options.includeRawEnvelope) {
				json.rawEnvelope = envelope;
			}
			items.push({ json });
		}

		if (items.length === 0) {
			// Nothing to process: answer 200 without starting the workflow
			return {};
		}

		return {
			workflowData: [items],
		};
	}
}
