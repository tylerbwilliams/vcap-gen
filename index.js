#!/usr/bin/env node

const DEBUG = false;

const fs = require('fs');
const https = require('https');
const url = require('url');
const util = require('util');
const path = require('path');

const async = require('async');
const inquirer = require('inquirer');

const location = path.resolve( process.cwd(), './services.json' );

const services = require( location );

const questions = [
	{	'message': 'API >',
		'name': 'paas',
		'default': 'https://api.ng.bluemix.net' }
];
inquirer.prompt( questions, fields => {
	
	const PAAS_HOST = fields.paas;
	
	const CF_AUTH = 'Basic Y2Y6';
	const INFO_URL = '/v2/info';

	const getInfo = { 'uri': `${PAAS_HOST}${INFO_URL}` };
	request( getInfo, ( err, res )=> {
		if ( err ) throw err;
		
		const UAA_API_URL = res['authorization_endpoint'];
		
		const questions = [
			{ 'message': 'CF Username >', 'name': 'username' },
			{ 'message': 'CF Password >', 'name': 'password', 'type': 'password' }
		];
		inquirer.prompt( questions, fields => {
			if ( err ) throw err;
			
			const USERNAME = fields.username;
			const PASSWORD = fields.password;
			
			const TOKEN_URL = '/oauth/token';
			
			const getAuth = {
				'method': 'POST',
				'auth': `${CF_AUTH}`,
				'uri': `${UAA_API_URL}${TOKEN_URL}`,
				'data': {
					'username': USERNAME,
					'password': PASSWORD,
					'grant_type': "password"
				}
			};
			request( getAuth, ( err, res )=> {
				if ( err ) throw err;
				
				const TOKEN_TYPE = res['token_type'];
				const ACCESS_TOKEN = res['access_token'];
				const REFRESH_TOKEN = res['refresh_token'];
				
				const TOKEN_AUTH = `${TOKEN_TYPE} ${ACCESS_TOKEN}`;
				
				const ORG_URL = '/v2/organizations';
				
				const getOrgs = {
					'auth': `${TOKEN_AUTH}`,
					'uri': `${PAAS_HOST}${ORG_URL}`
				};
				getResources( getOrgs, ( err, res )=> {
					if ( err ) throw err;
					
					if ( res['total_results'] == 0 ) throw new Error('No Orgs Found.');
					
					const resources = res['resources'];
					
					const questions = [
						{	'message': 'Organization >',
							'name': 'organization',
							'type': 'rawlist',
							'choices': resources.map( resource => resource.entity.name ) }
					];
					
					inquirer.prompt( questions, fields => {
						
						const ORGANIZATION = fields.organization;
						
						const resource = resources.filter( resource => {
							return resource.entity.name == ORGANIZATION;
						})[0];
						
						const SPACE_URL = resource['entity']['spaces_url'];
						
						const getSpaces = {
							'auth': `${TOKEN_AUTH}`,
							'uri': `${PAAS_HOST}${SPACE_URL}`
						};
						getResources( getSpaces, ( err, res )=> {
							if ( err ) throw err;
							
							if ( res['total_results'] == 0 ) throw new Error('No Spaces Found.');
							
							const resources = res['resources'];
							
							const questions = [
								{	'message': 'Space >',
									'name': 'space',
									'type': 'rawlist',
									'choices': resources.map( resource => resource.entity.name ) }
							];
							inquirer.prompt( questions, fields => {
								
								const SPACE = fields.space;
								
								const resource = resources.filter( resource => {
									return resource.entity.name == SPACE;
								})[0];
								
								const SERVICE_GUID = resource.metadata.guid;
								
								const INSTANCE_URL = resource['entity']['service_instances_url'];
								const APPS_URL = resource['entity']['apps_url'];
								
								const getAllServices = Object.keys( services ).map( service => {
									
									return function getService( done ) {
										
										const getAllInstances = services[service].map( instance => {
											
											return function getInstance( done ) {
												
												const name = instance.name;
												
												const instanceQuery = [
													'q=name:' + name
												].join('&');
												const getInstance = {
													'auth': `${TOKEN_AUTH}`,
													'uri': service === 'user-provided'
														? `${PAAS_HOST}/v2/user_provided_service_instances`
														: `${PAAS_HOST}${INSTANCE_URL}?${instanceQuery}`
												};
												getResources( getInstance, ( err, res )=> {
													if ( err ) throw err;
													
													const resources = res['resources']
														.filter( result => result.entity.name === name )
														.filter( result => result.entity.space_guid === SERVICE_GUID );
													
													if ( resources.length == 0 ) throw new Error(`No Service Found: ${name}`);
													
													if ( resources.length > 1 ) throw new Error('Multiple Services Found.');
													
													const resource = resources[0];
													
													const KEY_URL = resource['entity']['service_keys_url'];
													const BINDING_URL = resource['entity']['service_bindings_url'];
													
													const type = instance.type;
													
													if ( type === "service-key" ) {
														
														const key = instance.key;
														
														const keyQuery = [
															'q=name:'+ key
														].join('&');
														const getKey = {
															'auth': `${TOKEN_AUTH}`,
															'uri': `${PAAS_HOST}${KEY_URL}?${keyQuery}`
														};
														getResources( getKey, ( err, res )=> {
															
															if ( err ) throw err;
															
															if ( res['total_results'] == 0 ) throw new Error('No Credential Found.');
															
															if ( res['total_results'] > 1 ) throw new Error('Multiple Credentials Found.');
															
															const resource = res['resources'][0];
															
															const credentials = resource['entity']['credentials'];
															
															const instance = {
																"name": name,
																"label": service,
																"credentials": credentials
															};
															
															done( null, instance )
														});
													}
													else if ( type === "binding" ) {
														
														const app = instance.app;
														
														const appQuery = [
															'q=name:'+ app
														].join('&');
														const getApp = {
															'auth': `${TOKEN_AUTH}`,
															'uri': `${PAAS_HOST}${APPS_URL}?${appQuery}`
														};
														getResources( getApp, ( err, res )=> {
															
															if ( err ) throw err;
															
															if ( res['total_results'] == 0 ) throw new Error('No Application Found.');
															
															if ( res['total_results'] > 1 ) throw new Error('Multiple Applications Found.');
															
															const resource = res['resources'][0];
															
															const APP_GUID = resource['metadata']['guid'];
															
															const bindQuery = [
																'q=app_guid:'+ APP_GUID
															].join('&');
															const getBinding = {
																'auth': `${TOKEN_AUTH}`,
																'uri': `${PAAS_HOST}${BINDING_URL}?${bindQuery}`
															};
															getResources( getBinding, ( err, res )=> {
																
																if ( err ) throw err;
																
																if ( res['total_results'] == 0 ) throw new Error('No Binding Found.');
																
																if ( res['total_results'] > 1 ) throw new Error('Multiple Bindings Found.');
																
																const resource = res['resources'][0];
																
																const credentials = resource['entity']['credentials'];
																
																const instance = {
																	"name": name,
																	"label": service,
																	"credentials": credentials
																};
																
																done( null, instance )
															});
														});
													}
													else {
														throw new Error('Type missing or invalid.');
													}
												});
											};
										});
										async.parallel( getAllInstances, ( err, instances )=> {
											if ( err ) throw err;
											
											const serviceMap = { };
											serviceMap[service] = instances;
											
											done( null, serviceMap );
										});
									};
								});
								async.parallel( getAllServices, ( err, maps )=> {
									if ( err ) throw err;
									
									const result = Object.assign.apply(null, [{}].concat(maps));
									
									const output = JSON.stringify( result, null, "\t" );
									
									fs.writeFile('./credentials.json', output, err => {
										if ( err ) throw err;
										
										console.log('Credentials Generated Successfully.');
									});
								});
							});
						});
					});
				});
			});
		});
	});
});

function request( args, done ) {
	const method = args.method || 'GET';
	const auth = args.auth || null;
	const uri = args.uri || args.url;
	const data = args.data || null;
	const options = url.parse(uri);
	const encoding = 'application/x-www-form-urlencoded';
	options['method'] = method;
	options['headers'] = { };
	if ( auth ) options['headers']['Authorization'] = auth;
	if ( data ) options['headers']['Content-Type'] = encoding;
	const req = https.request( options, res => {
		const chunks = [];
		DEBUG && console.log(`REQUEST: ${uri}`);
		DEBUG && console.log(`STATUS: ${res.statusCode}`);
		DEBUG && console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
		res.setEncoding('utf8');
		res.on('data', chunk => chunks.push(chunk));
		res.on('error', done );
		res.on('end', () => {
			const data = chunks.join('');
			var json = null;
			try { json = JSON.parse(data); } catch (ex) { }
			const result = json || data;
			DEBUG && console.log(`RESPONSE: ${data}`);
			done( null, result );
		});
	});
	req.on('error', done );
	if ( data ) {
		const formData = Object.keys(data).map( key => {
			return key +'='+ data[key];
		}).join('&');
		req.write( formData );
	}
	req.end();
}

const getResources = ( options, callback )=> {
	const baseURL = options.uri.split('/v')[0];
	const sendRequest = ( uri, resources )=> {
		const nextOptions = Object.assign({}, options, { 'uri': uri });
		request( nextOptions, ( err, res )=> {
			if ( err ) {
				console.log( nextOptions );
				console.error( err );
				return callback( err, res );
			}
			const nextURL = res['next_url'];
			const combined = resources.concat( res['resources'] );
			if ( nextURL )
				return sendRequest( baseURL + nextURL, combined );
			res['resources'] = combined;
			return callback( err, res );
		});
	};
	sendRequest( options.uri, []);
};

const doRequest = args =>
	new Promise(( resolve, reject )=> {
		const method = args.method || 'GET';
		const auth = args.auth || null;
		const uri = args.uri || args.url;
		const data = args.data || null;
		const options = url.parse(uri);
		const encoding = 'application/x-www-form-urlencoded';
		options['method'] = method;
		options['headers'] = { };
		if ( auth ) options['headers']['Authorization'] = auth;
		if ( data ) options['headers']['Content-Type'] = encoding;
		const req = https.request( options, res => {
			const chunks = [];
			DEBUG && console.log(`REQUEST: ${uri}`);
			DEBUG && console.log(`STATUS: ${res.statusCode}`);
			DEBUG && console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			res.setEncoding('utf8');
			res.on('data', chunk => chunks.push(chunk));
			res.on('error', reject );
			res.on('end', () => {
				const data = chunks.join('');
				var json = null;
				try { json = JSON.parse(data); } catch (ex) { }
				const result = json || data;
				DEBUG && console.log(`RESPONSE: ${data}`);
				resolve( result );
			});
		});
		req.on('error', reject );
		if ( data ) {
			const formData = Object.keys(data).map( key => {
				return key +'='+ data[key];
			}).join('&');
			req.write( formData );
		}
		req.end();
	});

const prompt = questions =>
	new Promise( resolve => inquirer.prompt( questions, resolve ));
