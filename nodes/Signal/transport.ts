import {
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type JsonObject,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

// Node version from which the sender number is read from the credentials only
export const SENDER_IN_CREDENTIALS_VERSION = 1.2;

export async function signalApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
) {
	const credentials = await this.getCredentials('signalApi');
	const baseUrl = credentials.baseUrl as string;

	// Basic auth is added by the `authenticate` property of the credential
	const options: IHttpRequestOptions = {
		url: baseUrl + path,
		method,
		headers: {
			'Content-Type': 'application/json',
		},
		json: true,
		body,
		qs,
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'signalApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

// Versions before 1.2 have a "Sender Number" field on the node: it is used when set,
// the number of the credentials otherwise
export async function getSenderNumber(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	itemIndex?: number,
): Promise<string> {
	if (this.getNode().typeVersion < SENDER_IN_CREDENTIALS_VERSION) {
		const nodeNumber =
			itemIndex === undefined
				? ((this as ILoadOptionsFunctions).getCurrentNodeParameter('number') as string)
				: ((this as IExecuteFunctions).getNodeParameter('number', itemIndex, '') as string);
		if (nodeNumber) {
			return nodeNumber;
		}
	}

	const credentials = await this.getCredentials('signalApi');
	const number = ((credentials.number as string | undefined) ?? '').trim();
	if (!number) {
		throw new NodeOperationError(
			this.getNode(),
			'No sender number: set the Sender Number in the Signal API credentials',
			{ itemIndex },
		);
	}

	return number;
}
