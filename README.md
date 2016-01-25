# VCAP-Gen

Secure Credential Generator

## Install

```console
$ npm install -g vcap-gen
```

## Setup

Create a services definition file, named `services.json`.

```javascript
{
	"service-name": [
		{
			"name": "instance-name",
			"type": "service-key | binding",
			"key": "service key name",
			"app": "application name"
		}
	]
}
```

You can include multiple services, and multiple instances per service.

The `type` parameter determines whether to retrieve an unbound service key
or an application-bound service key.  It's recommended to give third-parties an
unbound service key where possible, so it can be deleted and regenerated when
access needs to be revoked.

- For `type` of `"service-key"`, fill in the `key` parameter.
- For `type` of `"binding"`, fill in the `app` parameter.

Note: You should include this file in your repository, so new developers can
quickly get started.

## Execute

Run VCAP-Gen in the directory that you placed the services definition file.

```console
$ vcap-gen
```

Follow the on-screen prompts for information to access your services.
This will generate a `credentials.json` file to be used for local development.

```javascript
{
	"service-name": [
		{
			"name": "instance-name",
			"label": "service-name",
			"credentials": {
				// Credentials...
			}
		}
	]
}
```

Note: You should not include this file in your repository, as it contains
secure information to backend services.
