import {
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type JsonObject,
	NodeApiError,
} from 'n8n-workflow';

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
