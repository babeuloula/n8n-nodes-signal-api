import {
	type IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SignalApi implements ICredentialType {
	name = 'signalApi';

	displayName = 'Signal API';

	documentationUrl = 'https://bbernhard.github.io/signal-cli-rest-api/#/General/get_v1_about';

	icon: Icon = {
		light: 'file:../icons/signal.svg',
		dark: 'file:../icons/signal.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			description: 'Base URL without trailing slash',
		},
		{
			displayName: 'User',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{ $credentials.username }}',
				password: '={{ $credentials.password }}',
				sendImmediately: true,
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{ $credentials.baseUrl + "/v1/about" }}',
		},
	};
}
