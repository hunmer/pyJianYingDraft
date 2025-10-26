import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class JianyingDraftApi implements ICredentialType {
	name = 'jianyingDraftApi';
	displayName = 'Jianying Draft API';
	documentationUrl = 'https://github.com/your-username/n8n-nodes-jianying-draft';
	properties: INodeProperties[] = [
		{
			displayName: 'API Base URL',
			name: 'apiBase',
			type: 'string',
			default: 'http://127.0.0.1:8000',
			placeholder: 'http://127.0.0.1:8000',
			description: 'pyJianYingDraftServer API服务器基础地址',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiBase}}',
			url: '/health',
			method: 'GET',
		},
	};
}
