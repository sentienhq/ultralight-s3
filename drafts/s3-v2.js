'use strict';

import { createHash, createHmac } from 'node:crypto';
import { URL, URLSearchParams } from 'node:url';

const expectArray = {
	contents: true,
};

export default class s3ClaudeClient {
	constructor({ accessKeyId, secretAccessKey, endpoint, bucketName = '', region = 'auto', cache, retries = 10, initRetryMs = 50 }) {
		if (typeof accessKeyId !== 'string' || accessKeyId.length === 0) throw new TypeError('accessKeyId must be a non-empty string');
		if (typeof secretAccessKey !== 'string' || secretAccessKey.length === 0)
			throw new TypeError('secretAccessKey must be a non-empty string');
		if (typeof endpoint !== 'string' || endpoint.length === 0) throw new TypeError('endpoint must be a non-empty string');
		this.accessKeyId = accessKeyId;
		this.secretAccessKey = secretAccessKey;
		this.endpoint = endpoint;
		this.bucketName = bucketName;
		this.region = region;
		this.cache = cache || new Map();
		this.retries = retries;
		this.initRetryMs = initRetryMs;
	}

	async sign(method, path, query, headers, body) {
		const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
		const url = new URL(path, this.endpoint);
		const encodedBucketName = encodeURIComponent(this.bucketName);
		url.pathname = `/${encodedBucketName}${url.pathname}`;

		const canonicalHeaders = Object.entries(headers)
			.map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
			.sort()
			.join('\n');

		const signedHeaders = Object.keys(headers)
			.map((key) => key.toLowerCase())
			.sort()
			.join(';');

		const canonicalRequest = [
			method,
			encodeURI(url.pathname),
			buildCanonicalQueryString(query),
			canonicalHeaders + '\n',
			signedHeaders,
			body ? await hash(body) : 'UNSIGNED-PAYLOAD',
		].join('\n');

		const credentialScope = [datetime.slice(0, 8), this.region, 's3', 'aws4_request'].join('/');
		const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, await hash(canonicalRequest)].join('\n');

		const signingKey = await getSignatureKey(this.secretAccessKey, datetime.slice(0, 8), this.region, 's3');
		const signature = await hmac(signingKey, stringToSign, 'hex');

		const authorizationHeader = [
			'AWS4-HMAC-SHA256 Credential=' + this.accessKeyId + '/' + credentialScope,
			'SignedHeaders=' + signedHeaders,
			'Signature=' + signature,
		].join(', ');

		headers['Authorization'] = authorizationHeader;
		headers['x-amz-content-sha256'] = body ? await hash(body) : 'UNSIGNED-PAYLOAD';
		headers['x-amz-date'] = datetime;
		headers['host'] = url.host;

		return {
			url: url.toString(),
			headers: headers,
		};
	}

	async list(prefix = '', maxKeys = 1000, method = 'GET') {
		const query = {
			'list-type': '2',
			'max-keys': String(maxKeys),
		};

		const path = '/';
		const headers = {
			'Content-Type': 'application/json',
			'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
		};

		const { url, headers: signedHeaders } = await this.sign('GET', path, query, headers, '');

		const searchParams = new URLSearchParams(query);
		const urlWithQuery = `${url}?${searchParams.toString()}`;

		console.log('Request URL:', urlWithQuery);
		console.log('Request Headers:', signedHeaders);

		const res = await fetch(urlWithQuery, { headers: signedHeaders });

		console.log('Response Status:', res.status);
		console.log('Response Headers:', res.headers);

		if (!res.ok) {
			const errorBody = await res.text();
			console.log('Error Body:', errorBody);
			const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
			const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
			throw new Error(`ListV2 failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
		}

		let data = '';
		let responseBody = await res.text();
		if (res.statusCode > 299) {
			data =
				(method !== 'HEAD' && parseXml(responseBody).error) ||
				(path ? 'The specified key does not exist.' : 'The specified bucket is not valid.');
			throw new Error(errorMessage);
		}
		data =
			method === 'GET'
				? parseXml(responseBody)
				: {
						size: +res.headers['content-length'],
						mtime: new Date(res.headers['last-modified']),
						etag: res.headers.etag,
				  };
		return data.listBucketResult || data.error || data;
	}

	async get(path, opts) {
		const query = opts || {};
		const headers = {
			'Content-Type': 'application/json',
			'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
		};

		const { url, headers: signedHeaders } = await this.sign('GET', path, query, headers, '');

		// TODO - comment out later
		// console.log('Request URL:', url);
		// console.log('Request Headers:', signedHeaders);

		const res = await fetch(url, { headers: signedHeaders });

		// TODO - comment out later
		// console.log('Response Status:', res.status);
		// console.log('Response Headers:', res.headers);

		if (!res.ok) {
			const errorBody = await res.text();
			console.log('Error Body:', errorBody);
			const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
			const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
			throw new Error(`GET failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
		}

		return res.text();
	}

	async put(path, data, opts) {
		const query = opts || {};
		const headers = {
			'Content-Length': data.length,
		};

		const { url, headers: signedHeaders } = await this.sign('PUT', path, query, headers, data);

		console.log('Request URL:', url);
		console.log('Request Headers:', signedHeaders);

		const res = await fetch(url, { method: 'PUT', headers: signedHeaders, body: data });

		console.log('Response Status:', res.status);
		console.log('Response Headers:', res.headers);

		if (!res.ok) {
			const errorBody = await res.text();
			console.log('Error Body:', errorBody);
			const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
			const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
			throw new Error(`PUT failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
		}

		return res.json();
	}

	async delete(path, opts) {
		const query = opts || {};
		const headers = {};

		const { url, headers: signedHeaders } = await this.sign('DELETE', path, query, headers, '');

		console.log('Request URL:', url);
		console.log('Request Headers:', signedHeaders);

		const res = await fetch(url, { method: 'DELETE', headers: signedHeaders });

		console.log('Response Status:', res.status);
		console.log('Response Headers:', res.headers);

		if (!res.ok) {
			const errorBody = await res.text();
			console.log('Error Body:', errorBody);
			const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
			const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
			throw new Error(`DELETE failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
		}

		return res.json();
	}
}

function buildCanonicalQueryString(queryParams) {
	if (Object.keys(queryParams).length < 1) {
		return '';
	}

	const sortedQueryParams = Object.keys(queryParams).sort();

	let canonicalQueryString = '';
	for (let i = 0; i < sortedQueryParams.length; i++) {
		canonicalQueryString += encodeURIComponent(sortedQueryParams[i]) + '=' + encodeURIComponent(queryParams[sortedQueryParams[i]]) + '&';
	}
	return canonicalQueryString.slice(0, -1);
}

async function getSignatureKey(secretAccessKey, dateStamp, region, serviceName) {
	const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
	const kRegion = await hmac(kDate, region);
	const kService = await hmac(kRegion, serviceName);
	const kSigning = await hmac(kService, 'aws4_request');
	return kSigning;
}

async function hash(content) {
	const hashSum = createHash('sha256');
	hashSum.update(content);
	return hashSum.digest('hex');
}

async function hmac(key, content, encoding) {
	const hmacSum = createHmac('sha256', key);
	hmacSum.update(content);
	return hmacSum.digest(encoding);
}

const parseXml = (str) => {
	const unescapeXml = (value) => {
		return value
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&');
	};

	let key, val;
	const json = {};
	const re = /<(\w)([-\w]+)(?:\/|[^>]*>((?:(?!<\1)[\s\S])*)<\/\1\2)>/gm;
	for (; (val = re.exec(str)); ) {
		key = val[1].toLowerCase() + val[2];
		val = val[3] != null ? parseXml(val[3]) : true;
		if (typeof val === 'string') {
			val = unescapeXml(val);
		}
		if (Array.isArray(json[key])) json[key].push(val);
		else json[key] = json[key] != null ? [json[key], val] : expectArray[key] ? [val] : val;
	}
	return key ? json : str;
};

const isObj = (obj) => !!obj && obj.constructor === Object;
