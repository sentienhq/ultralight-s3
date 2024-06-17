'use strict';

// brillout/import - Avoids bundlers from bundling crypto and others in the browser (see https://github.com/brillout/import)
// import { import_ } from './import-override.js';

// const _hasCrypto =
//   typeof crypto !== 'undefined' &&
//   typeof crypto.randomUUID === 'function' &&
//   typeof crypto.subtle.digest === 'function';

let _crypto;
let _randomUUID;
let _createHmac;
let _createHash;

import('node:crypto').then(nodeCrypto => {
  _crypto = nodeCrypto;
  _randomUUID = nodeCrypto.randomUUID;
  _createHmac = nodeCrypto.createHmac;
  _createHash = nodeCrypto.createHash;
});

// if (_hasCrypto) {
//   console.log('worker crypto');
//   _crypto = crypto;
//   _randomUUID = crypto.randomUUID;
//   _createHash = algorithm => {
//     const algo = {
//       name: 'SHA-256',
//     };
//     let data = '';
//     return {
//       update: newData => {
//         data += newData;
//         return this;
//       },
//       digest: async (encoding = 'hex') => {
//         const encoder = new TextEncoder();
//         const dataBuffer = encoder.encode(data);
//         const hashBuffer = await crypto.subtle.digest(algo, dataBuffer);
//         const hashArray = Array.from(new Uint8Array(hashBuffer));

//         if (encoding === 'hex') {
//           return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
//         }
//         console.log('HashArray: ', hashArray);
//         return hashArray;
//       },
//     };
//   };
//   _createHmac = (algorithm, key) => {
//     const algo = { name: 'HMAC', hash: 'SHA-256' };
//     const encoder = new TextEncoder();
//     const keyBuffer = encoder.encode(key);
//     let data = '';

//     return {
//       update: newData => {
//         data += newData;
//         return this;
//       },
//       digest: async (encoding = 'hex') => {
//         const encoder = new TextEncoder();
//         const dataBuffer = encoder.encode(data);
//         const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, algo, false, ['sign', 'verify']);
//         const signature = await crypto.subtle.sign(algo, cryptoKey, dataBuffer);
//         console.log('Signature: ', signature);
//         if (encoding === 'hex') {
//           return Array.from(new Uint8Array(signature))
//             .map(b => b.toString(16).padStart(2, '0'))
//             .join('');
//         }

//         return new Uint8Array(signature);
//       },
//     };
//   };
//   // finish this -> https://developers.cloudflare.com/workers/runtime-apis/web-crypto
// } else if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
//   console.log('browser crypto');
//   _crypto = window.crypto.subtle;
//   _randomUUID = () => {
//     const bytes = new Uint8Array(16);
//     _crypto.getRandomValues(bytes);
//     bytes[6] = (bytes[6] & 0x0f) | 0x40;
//     bytes[8] = (bytes[8] & 0x3f) | 0x80;
//     const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
//     return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
//   };

//   _createHash = algorithm => {
//     const algo = 'SHA-256';
//     let data = '';
//     return {
//       update: newData => {
//         data = newData;
//         return this;
//       },
//       digest: async (encoding = 'hex') => {
//         const encoder = new TextEncoder();
//         const dataBuffer = encoder.encode(data);
//         const hashBuffer = await _crypto.digest(algo, dataBuffer);
//         const hashArray = Array.from(new Uint8Array(hashBuffer));

//         if (encoding === 'hex') {
//           return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
//         }

//         return hashArray;
//       },
//     };
//   };

//   _createHmac = (algorithm, key) => {
//     const algo = { name: 'HMAC', hash: 'SHA-256' };
//     const encoder = new TextEncoder();
//     const keyBuffer = encoder.encode(key);
//     let data = '';

//     return {
//       update: newData => {
//         data += newData;
//         return this;
//       },
//       digest: async function (encoding = 'hex') {
//         const encoder = new TextEncoder();
//         const dataBuffer = encoder.encode(data);
//         const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, algo, false, ['sign', 'verify']);
//         const signature = await crypto.subtle.sign(algo, cryptoKey, dataBuffer);

//         if (encoding === 'hex') {
//           return Array.from(new Uint8Array(signature))
//             .map(b => b.toString(16).padStart(2, '0'))
//             .join('');
//         }

//         return new Uint8Array(signature);
//       },
//     };
//   };
// } else {
//   console.log('node crypto');

// }

// import { createHash, createHmac } from 'node:crypto';
// import { URL, URLSearchParams } from 'node:url';

const expectArray = {
  contents: true,
};

class S3 {
  constructor({
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucketName = '',
    region = 'auto',
    cache,
    retries = 10,
    initRetryMs = 50,
  }) {
    if (typeof accessKeyId !== 'string' || accessKeyId.length === 0)
      throw new TypeError('accessKeyId must be a non-empty string');
    if (typeof secretAccessKey !== 'string' || secretAccessKey.length === 0)
      throw new TypeError('secretAccessKey must be a non-empty string');
    if (typeof endpoint !== 'string' || endpoint.length === 0)
      throw new TypeError('endpoint must be a non-empty string');
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.endpoint = endpoint;
    this.bucketName = bucketName;
    this.region = region;
    this.cache = cache || new Map();
    this.retries = retries;
    this.initRetryMs = initRetryMs;
  }

  getBucketName = () => {
    return this.bucketName;
  };

  getRegion = () => {
    return this.region;
  };

  getEndpoint = () => {
    return this.endpoint;
  };

  getProps = () => {
    return {
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      bucket: this.bucket,
    };
  };

  hasCrpyto = () => _hasCrypto;

  async sign(method, path, query, headers, body) {
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const url = new URL(path, this.endpoint);
    const encodedBucketName = encodeURIComponent(this.bucketName);
    url.pathname = `/${encodedBucketName}${url.pathname}`;

    const canonicalHeaders = Object.entries(headers)
      .map(([key, value]) => `${key.toLowerCase()}:${String(value).trim()}`)
      .sort()
      .join('\n');

    const signedHeaders = Object.keys(headers)
      .map(key => key.toLowerCase())
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

  async list(path = '/', prefix = '', maxKeys = 1000, method = 'GET') {
    const query = {
      'list-type': '2',
      'max-keys': String(maxKeys),
    };

    const headers = {
      'Content-Type': 'application/json',
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    };

    const { url, headers: signedHeaders } = await this.sign('GET', path, query, headers, '');

    const searchParams = new URLSearchParams(query);
    const urlWithQuery = `${url}?${searchParams.toString()}`;

    // console.log('Request URL:', urlWithQuery);
    // console.log('Request Headers:', signedHeaders);

    const res = await fetch(urlWithQuery, { headers: signedHeaders });

    // console.log('Response Status:', res.status);
    // console.log('Response Headers:', res.headers);

    if (!res.ok) {
      const errorBody = await res.text();
      console.log('Error Body:', errorBody);
      const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
      const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
      throw new Error(`ListV2 failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
    }

    let data = [];
    let responseBody = await res.text();
    if (res.statusCode > 299) {
      data =
        (method !== 'HEAD' && parseXml(responseBody).error) ||
        (path ? 'The specified key does not exist.' : 'The specified bucket is not valid.');
      throw new Error('yadada: ' + errorMessage);
    }
    data =
      method === 'GET'
        ? parseXml(responseBody)
        : {
            size: +res.headers['content-length'],
            mtime: new Date(res.headers['last-modified']),
            etag: res.headers.etag,
          };
    const output = data.listBucketResult || data.error || data;
    return output.contents || output;
  }

  async get(key, opts) {
    const query = opts || {};
    const headers = {
      'Content-Type': 'application/json',
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    };

    const { url, headers: signedHeaders } = await this.sign('GET', key, query, headers, '');

    // console.log('Request URL:', url);
    // console.log('Request Headers:', signedHeaders);

    const res = await fetch(url, { headers: signedHeaders });

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

  async put(key, data, opts) {
    const query = opts || {};
    const headers = {
      'Content-Length': data.length,
    };

    const { url, headers: signedHeaders } = await this.sign('PUT', key, query, headers, data);

    // console.log('Request URL:', url);
    // console.log('Request Headers:', signedHeaders);

    const res = await fetch(url, { method: 'PUT', headers: signedHeaders, body: data });

    // console.log('Response Status:', res.status);
    // console.log('Response Headers:', res.headers);

    if (!res.ok) {
      const errorBody = await res.text();
      console.log('Error Body:', errorBody);
      const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
      const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
      throw new Error(`PUT failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
    }

    return res;
  }

  async delete(path, opts) {
    const query = opts || {};
    const headers = {};

    const { url, headers: signedHeaders } = await this.sign('DELETE', path, query, headers, '');

    // console.log('Request URL:', url);
    // console.log('Request Headers:', signedHeaders);

    const res = await fetch(url, { method: 'DELETE', headers: signedHeaders });

    // console.log('Response Status:', res.status);
    // console.log('Response Headers:', res.headers);

    if (!res.ok) {
      const errorBody = await res.text();
      // console.log('Error Body:', errorBody);
      const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
      const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
      throw new Error(`DELETE failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
    }

    return res.json();
  }
}

const buildCanonicalQueryString = queryParams => {
  if (Object.keys(queryParams).length < 1) {
    return '';
  }

  const sortedQueryParams = Object.keys(queryParams).sort();

  let canonicalQueryString = '';
  for (let i = 0; i < sortedQueryParams.length; i++) {
    canonicalQueryString +=
      encodeURIComponent(sortedQueryParams[i]) + '=' + encodeURIComponent(queryParams[sortedQueryParams[i]]) + '&';
  }
  return canonicalQueryString.slice(0, -1);
};

const getSignatureKey = async (secretAccessKey, dateStamp, region, serviceName) => {
  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, serviceName);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
};

const hash = async content => {
  const hashSum = _createHash('sha256');
  hashSum.update(content);
  return hashSum.digest('hex');
};

const hmac = async (key, content, encoding) => {
  const hmacSum = _createHmac('sha256', key);
  console.warn('hmac', key, content, hmacSum);
  hmacSum.update(content);
  return hmacSum.digest(encoding);
};

const parseXml = str => {
  const unescapeXml = value => {
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

// const isObj = obj => !!obj && obj.constructor === Object;

// if (typeof window !== 'undefined') {
//   window.S3 = S3;
// }

export { S3 };
export default S3;
