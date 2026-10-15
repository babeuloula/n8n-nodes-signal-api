import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
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
	const username = credentials.username as string;
	const password = credentials.password as string;

	const options: IHttpRequestOptions = {
		url: baseUrl + path,
		method,
		auth: {
			username,
			password,
			sendImmediately: true,
		},
		headers: {
			'Content-Type': 'application/json',
		},
		json: true,
		body,
		qs,
	};

	return await this.helpers.httpRequest(options);
}
