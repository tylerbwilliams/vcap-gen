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
			"credential": "instance service key name"
		}
	]
}
```

You can include multiple services, and multiple instances per service.

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
