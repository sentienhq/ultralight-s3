'use strict';
const _createHmac = crypto.createHmac || (await import('node:crypto').then(m => m.createHmac));
const _createHash = crypto.createHash || (await import('node:crypto').then(m => m.createHash));

if (typeof _createHmac === 'undefined' && typeof _createHash === 'undefined') {
  console.error('Crypto functions are not available, please report this issue');
}

// Constants
const AWS_ALGORITHM = 'AWS4-HMAC-SHA256';
const AWS_REQUEST_TYPE = 'aws4_request';
const S3_SERVICE = 's3';
const LIST_TYPE = '2';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';
const DEFAULT_STREAM_CONTENT_TYPE = 'application/octet-stream';
const XML_CONTENT_TYPE = 'application/xml';
const JSON_CONTENT_TYPE = 'application/json';

// Headers
const HEADER_AMZ_CONTENT_SHA256 = 'x-amz-content-sha256';
const HEADER_AMZ_DATE = 'x-amz-date';
const HEADER_HOST = 'host';
const HEADER_AUTHORIZATION = 'Authorization';
const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_CONTENT_LENGTH = 'Content-Length';

const expectArray = {
  contents: true,
};

/**
 * S3 class for interacting with S3-compatible object storage services.
 * This class provides methods for common S3 operations such as uploading, downloading,
 * and deleting objects, as well as multipart uploads.
 *
 * @class
 * @example
 * const s3 = new S3({
 *   accessKeyId: 'your-access-key',
 *   secretAccessKey: 'your-secret-key',
 *   endpoint: 'https://your-s3-endpoint.com',
 *   bucketName: 'your-bucket-name',
 *   region: 'us-east-1'
 * });
 *
 * // Upload a file
 * await s3.put('example.txt', 'Hello, World!');
 *
 * // Download a file
 * const content = await s3.get('example.txt');
 *
 * // Delete a file
 * await s3.delete('example.txt');
 */
class S3 {
  /**
   * Creates an instance of the S3 class.
   *
   * @constructor
   * @param {Object} config - Configuration options for the S3 instance.
   * @param {string} config.accessKeyId - The access key ID for authentication.
   * @param {string} config.secretAccessKey - The secret access key for authentication.
   * @param {string} config.endpoint - The endpoint URL of the S3-compatible service.
   * @param {string} [config.bucketName=''] - The name of the bucket to operate on.
   * @param {string} [config.region='auto'] - The region of the S3 service.
   * @param {number} [config.maxRequestSizeInBytes=5242880] - The maximum size of a single request in bytes (default is 5MB).
   * @param {number} [config.requestAbortTimeout=undefined] - The timeout in milliseconds after which a request should be aborted.
   * @param {Object} [config.logger=null] - A logger object with methods like info, warn, error.
   * @throws {TypeError} Will throw an error if required parameters are missing or of incorrect type.
   */
  constructor({
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucketName = '',
    region = 'auto',
    maxRequestSizeInBytes = 5 * 1024 * 1024,
    requestAbortTimeout = undefined,
    logger = null,
  }) {
    this._validateConstructorParams(accessKeyId, secretAccessKey, endpoint);
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.endpoint = endpoint;
    this.bucketName = bucketName;
    this.region = region;
    this.maxRequestSizeInBytes = maxRequestSizeInBytes;
    this.requestAbortTimeout = requestAbortTimeout;
    this.logger = logger;
  }

  _validateConstructorParams(accessKeyId, secretAccessKey, endpoint) {
    if (typeof accessKeyId !== 'string' || accessKeyId.length === 0)
      throw new TypeError('accessKeyId must be a non-empty string');
    if (typeof secretAccessKey !== 'string' || secretAccessKey.length === 0)
      throw new TypeError('secretAccessKey must be a non-empty string');
    if (typeof endpoint !== 'string' || endpoint.length === 0)
      throw new TypeError('endpoint must be a non-empty string');
  }

  /**
   * Internal method to log messages.
   * @param {string} level - The log level (e.g., 'info', 'warn', 'error').
   * @param {string} message - The message to log.
   * @private
   */
  _log(level, message) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message);
    }
  }

  getBucketName = () => this.bucketName;
  setBucketName = bucketName => {
    this.bucketName = bucketName;
  };
  getRegion = () => this.region;
  setRegion = region => {
    this.region = region;
  };
  getEndpoint = () => this.endpoint;
  setEndpoint = endpoint => {
    this.endpoint = endpoint;
  };
  getMaxRequestSizeInBytes = () => this.maxRequestSizeInBytes;
  setMaxRequestSizeInBytes = maxRequestSizeInBytes => {
    this.maxRequestSizeInBytes = maxRequestSizeInBytes;
  };

  getProps = () => ({
    accessKeyId: this.accessKeyId,
    secretAccessKey: this.secretAccessKey,
    region: this.region,
    bucket: this.bucketName,
  });
  setProps = props => {
    this._validateConstructorParams(props.accessKeyId, props.secretAccessKey, props.endpoint);
    this.accessKeyId = props.accessKeyId;
    this.secretAccessKey = props.secretAccessKey;
    this.region = props.region;
    this.bucketName = props.bucket;
    this.endpoint = props.endpoint;
    this.maxRequestSizeInBytes = props.maxRequestSizeInBytes;
    this.requestAbortTimeout = props.requestAbortTimeout;
  };

  /**
   * Get the content length of an object.
   * @param {string} key - The key of the object.
   * @returns {Promise<number>} The content length of the object in bytes.
   * @throws {TypeError} If the key is not a non-empty string.
   */
  async getContentLength(key) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      this._log('error', 'key must be a non-empty string');
      throw new TypeError('key must be a non-empty string');
    }
    const headers = { [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD };
    const { url, headers: signedHeaders } = await this._sign('HEAD', key, {}, headers, '');
    const res = await this._sendRequest(url, 'HEAD', signedHeaders);
    const contentLength = res.headers.get(HEADER_CONTENT_LENGTH);
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  /**
   * Check if a file exists in the bucket.
   * @param {string} key - The key of the object.
   * @returns {Promise<boolean>} True if the file exists, false otherwise.
   * @throws {TypeError} If the key is not a non-empty string.
   */
  async fileExists(key) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      this._log('error', 'key must be a non-empty string');
      throw new TypeError('key must be a non-empty string');
    }
    const headers = { [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD };
    const { url, headers: signedHeaders } = await this._sign('HEAD', key, {}, headers, '');
    const res = await this._sendRequest(url, 'HEAD', signedHeaders);
    return res.ok;
  }

  async _sign(method, path, query, headers, body) {
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const url = new URL(path, this.endpoint);
    url.pathname = `/${encodeURIComponent(this.bucketName)}${url.pathname}`;

    const canonicalHeaders = this._buildCanonicalHeaders(headers);
    const signedHeaders = Object.keys(headers)
      .map(key => key.toLowerCase())
      .sort()
      .join(';');

    const canonicalRequest = await this._buildCanonicalRequest(
      method,
      url,
      query,
      canonicalHeaders,
      signedHeaders,
      body,
    );
    const stringToSign = await this._buildStringToSign(datetime, canonicalRequest);
    const signature = await this._calculateSignature(datetime, stringToSign);

    const authorizationHeader = this._buildAuthorizationHeader(datetime, signedHeaders, signature);

    headers[HEADER_AUTHORIZATION] = authorizationHeader;
    headers[HEADER_AMZ_CONTENT_SHA256] = body ? await _hash(body) : UNSIGNED_PAYLOAD;
    headers[HEADER_AMZ_DATE] = datetime;
    headers[HEADER_HOST] = url.host;

    return { url: url.toString(), headers };
  }

  _buildCanonicalHeaders(headers) {
    return Object.entries(headers)
      .map(([key, value]) => `${key.toLowerCase()}:${String(value).trim()}`)
      .sort()
      .join('\n');
  }

  async _buildCanonicalRequest(method, url, query, canonicalHeaders, signedHeaders, body) {
    return [
      method,
      encodeURI(url.pathname),
      this._buildCanonicalQueryString(query),
      `${canonicalHeaders}\n`,
      signedHeaders,
      body ? await _hash(body) : UNSIGNED_PAYLOAD,
    ].join('\n');
  }

  async _buildStringToSign(datetime, canonicalRequest) {
    const credentialScope = [datetime.slice(0, 8), this.region, S3_SERVICE, AWS_REQUEST_TYPE].join('/');
    return [AWS_ALGORITHM, datetime, credentialScope, await _hash(canonicalRequest)].join('\n');
  }

  async _calculateSignature(datetime, stringToSign) {
    const signingKey = await this._getSignatureKey(datetime.slice(0, 8));
    return _hmac(signingKey, stringToSign, 'hex');
  }

  _buildAuthorizationHeader(datetime, signedHeaders, signature) {
    const credentialScope = [datetime.slice(0, 8), this.region, S3_SERVICE, AWS_REQUEST_TYPE].join('/');
    return [
      `${AWS_ALGORITHM} Credential=${this.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');
  }

  /**
   * List objects in the bucket.
   * @param {string} [path='/'] - The path to list objects from.
   * @param {string} [prefix=''] - The prefix to filter objects.
   * @param {number} [maxKeys=1000] - The maximum number of keys to return.
   * @param {string} [method='GET'] - The HTTP method to use (GET or HEAD).
   * @param {Object} [opts={}] - Additional options for the list operation.
   * @returns {Promise<Object|Array>} The list of objects or object metadata.
   * @throws {TypeError} If any of the parameters are of incorrect type.
   */
  async list(path = '/', prefix = '', maxKeys = 1000, method = 'GET', opts = {}) {
    if (typeof path !== 'string' || path.trim().length === 0) {
      throw new TypeError('path must be a string');
    }
    if (typeof prefix !== 'string') {
      throw new TypeError('prefix must be a string');
    }
    if (!Number.isInteger(maxKeys) || maxKeys <= 0) {
      throw new TypeError('maxKeys must be a positive integer');
    }
    if (method !== 'GET' && method !== 'HEAD') {
      throw new TypeError('method must be either GET or HEAD');
    }
    if (typeof opts !== 'object') {
      throw new TypeError('opts must be an object');
    }
    const query = {
      'list-type': LIST_TYPE,
      'max-keys': String(maxKeys),
      ...opts,
    };
    const headers = {
      [HEADER_CONTENT_TYPE]: JSON_CONTENT_TYPE,
      [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD,
    };
    const { url, headers: signedHeaders } = await this._sign('GET', path, query, headers, '');
    const urlWithQuery = `${url}?${new URLSearchParams(query)}`;

    const res = await this._sendRequest(urlWithQuery, 'GET', signedHeaders);
    const responseBody = await res.text();

    if (method === 'HEAD') {
      return {
        size: +res.headers[HEADER_CONTENT_LENGTH],
        mtime: new Date(res.headers['last-modified']),
        etag: res.headers.etag,
      };
    }

    const data = _parseXml(responseBody);
    const output = data.listBucketResult || data.error || data;
    return output.contents || output;
  }

  /**
   * Get an object from the bucket.
   * @param {string} key - The key of the object to get.
   * @param {Object} [opts={}] - Additional options for the get operation.
   * @returns {Promise<string>} The content of the object.
   */
  async get(key, opts = {}) {
    const headers = {
      [HEADER_CONTENT_TYPE]: JSON_CONTENT_TYPE,
      [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD,
    };
    const { url, headers: signedHeaders } = await this._sign('GET', key, opts, headers, '');
    const res = await this._sendRequest(url, 'GET', signedHeaders);
    return res.text();
  }

  /**
   * Get a stream of an object from the bucket.
   * @param {string} key - The key of the object to get.
   * @param {boolean} [wholeFile=true] - Whether to get the whole file or a part.
   * @param {number} [part=0] - The part number to get if not getting the whole file.
   * @param {number} [chunkSizeInB=this.maxRequestSizeInBytes] - The size of each chunk in bytes.
   * @param {Object} [opts={}] - Additional options for the get operation.
   * @returns {Promise<ReadableStream>} A readable stream of the object content.
   */
  async getStream(key, wholeFile = true, part = 0, chunkSizeInB = this.maxRequestSizeInBytes, opts = {}) {
    const query = wholeFile ? opts : { partNumber: part, ...opts };
    const headers = {
      [HEADER_CONTENT_TYPE]: JSON_CONTENT_TYPE,
      [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD,
      ...(wholeFile ? {} : { range: `bytes=${part * chunkSizeInB}-${(part + 1) * chunkSizeInB - 1}` }),
    };

    const { url, headers: signedHeaders } = await this._sign('GET', key, query, headers, '');
    const urlWithQuery = `${url}?${new URLSearchParams(query)}`;

    const res = await this._sendRequest(urlWithQuery, 'GET', signedHeaders);
    return res.body;
  }

  /**
   * Put an object into the bucket.
   * @param {string} key - The key of the object to put.
   * @param {Buffer|string} data - The content of the object to put.
   * @returns {Promise<Object>} The response from the put operation.
   * @throws {TypeError} If the key is not a non-empty string or data is not a Buffer or string.
   */
  async put(key, data) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (!(data instanceof Buffer || typeof data === 'string')) {
      throw new TypeError('data must be a Buffer or string');
    }
    const headers = { [HEADER_CONTENT_LENGTH]: data.length };
    const { url, headers: signedHeaders } = await this._sign('PUT', key, {}, headers, data);

    const res = await this._sendRequest(url, 'PUT', signedHeaders, data);
    return res;
  }

  /**
   * Initiate a multipart upload.
   * @param {string} key - The key of the object to upload.
   * @param {string} [fileType='application/octet-stream'] - The MIME type of the file.
   * @returns {Promise<string>} The upload ID for the multipart upload.
   * @throws {TypeError} If the key is not a non-empty string or fileType is not a string.
   * @throws {Error} If the multipart upload initiation fails.
   */
  async getMultipartUploadId(key, fileType = DEFAULT_STREAM_CONTENT_TYPE) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof fileType !== 'string') {
      throw new TypeError('fileType must be a string');
    }
    const query = { uploads: '' };
    const headers = {
      [HEADER_CONTENT_TYPE]: fileType,
      [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD,
    };

    const { url, headers: signedHeaders } = await this._sign('POST', key, query, headers, '');
    const urlWithQuery = `${url}?${new URLSearchParams(query)}`;

    const res = await this._sendRequest(urlWithQuery, 'POST', signedHeaders);
    const responseBody = await res.text();
    const parsedResponse = _parseXml(responseBody);

    if (parsedResponse.error) {
      throw new Error(`Failed to create multipart upload: ${parsedResponse.error.message}`);
    }

    if (!parsedResponse.initiateMultipartUploadResult || !parsedResponse.initiateMultipartUploadResult.uploadId) {
      throw new Error('Failed to create multipart upload: Missing upload ID in response');
    }

    return parsedResponse.initiateMultipartUploadResult.uploadId;
  }

  /**
   * Upload a part in a multipart upload.
   * @param {string} key - The key of the object being uploaded.
   * @param {Buffer|string} data - The content of the part.
   * @param {string} uploadId - The upload ID of the multipart upload.
   * @param {number} partNumber - The part number.
   * @param {Object} [opts={}] - Additional options for the upload.
   * @returns {Promise<Object>} The ETag and part number of the uploaded part.
   * @throws {TypeError} If any of the parameters are of incorrect type.
   */
  async uploadPart(key, data, uploadId, partNumber, opts = {}) {
    this._validateUploadPartParams(key, data, uploadId, partNumber, opts);
    const query = { uploadId, partNumber, ...opts };
    const headers = { [HEADER_CONTENT_LENGTH]: data.length };
    const { url, headers: signedHeaders } = await this._sign('PUT', key, query, headers, data);
    const urlWithQuery = `${url}?${new URLSearchParams(query)}`;

    const res = await this._sendRequest(urlWithQuery, 'PUT', signedHeaders, data);
    const etag = res.headers.get('etag');
    return { etag, partNumber };
  }

  _validateUploadPartParams(key, data, uploadId, partNumber, opts) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (!(data instanceof Buffer || typeof data === 'string')) {
      throw new TypeError('data must be a Buffer or string');
    }
    if (typeof uploadId !== 'string' || uploadId.trim().length === 0) {
      throw new TypeError('uploadId must be a non-empty string');
    }
    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      throw new TypeError('partNumber must be a positive integer');
    }
    if (typeof opts !== 'object') {
      throw new TypeError('opts must be an object');
    }
  }

  /**
   * Complete a multipart upload.
   * @param {string} key - The key of the object being uploaded.
   * @param {string} uploadId - The upload ID of the multipart upload.
   * @param {Array<Object>} parts - An array of objects containing PartNumber and ETag for each part.
   * @returns {Promise<Object>} The result of the complete multipart upload operation.
   * @throws {TypeError} If any of the parameters are of incorrect type.
   * @throws {Error} If the complete multipart upload operation fails.
   */
  async completeMultipartUpload(key, uploadId, parts) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof uploadId !== 'string' || uploadId.trim().length === 0) {
      throw new TypeError('uploadId must be a non-empty string');
    }
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new TypeError('parts must be a non-empty array');
    }
    if (!parts.every(part => typeof part.PartNumber === 'number' && typeof part.ETag === 'string')) {
      throw new TypeError('Each part must have a PartNumber (number) and ETag (string)');
    }
    const query = { uploadId };
    const xmlBody = this._buildCompleteMultipartUploadXml(parts);
    const headers = {
      [HEADER_CONTENT_TYPE]: XML_CONTENT_TYPE,
      [HEADER_CONTENT_LENGTH]: Buffer.byteLength(xmlBody).toString(),
      [HEADER_AMZ_CONTENT_SHA256]: await _hash(xmlBody),
    };

    const { url, headers: signedHeaders } = await this._sign('POST', key, query, headers, xmlBody);
    const urlWithQuery = `${url}?${new URLSearchParams(query)}`;

    const res = await this._sendRequest(urlWithQuery, 'POST', signedHeaders, xmlBody);
    const responseBody = await res.text();
    const parsedResponse = _parseXml(responseBody);

    if (parsedResponse.error) {
      throw new Error(`Failed to complete multipart upload: ${parsedResponse.error.message}`);
    }

    return parsedResponse.completeMultipartUploadResult;
  }

  /**
   * Aborts a multipart upload.
   * @param {string} key - The key of the object being uploaded.
   * @param {string} uploadId - The ID of the multipart upload to abort.
   * @returns {Promise<Object>} - A promise that resolves to the abort response.
   * @throws {Error} If the abort operation fails.
   */
  async abortMultipartUpload(key, uploadId) {
    // Input validation
    if (typeof key !== 'string' || key.trim().length === 0) {
      this._log('error', 'key must be a non-empty string');
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof uploadId !== 'string' || uploadId.trim().length === 0) {
      this._log('error', 'uploadId must be a non-empty string');
      throw new TypeError('uploadId must be a non-empty string');
    }

    // Prepare the request
    const query = { uploadId };
    const headers = {
      [HEADER_CONTENT_TYPE]: XML_CONTENT_TYPE,
      [HEADER_AMZ_CONTENT_SHA256]: UNSIGNED_PAYLOAD,
    };

    try {
      // Sign and send the request
      const { url, headers: signedHeaders } = await this._sign('DELETE', key, query, headers, '');
      const urlWithQuery = `${url}?${new URLSearchParams(query)}`;

      const res = await this._sendRequest(urlWithQuery, 'DELETE', signedHeaders);

      // Check for successful response
      if (res.ok) {
        const responseBody = await res.text();
        const parsedResponse = _parseXml(responseBody);

        if (parsedResponse.error) {
          this._log('error', `Failed to abort multipart upload: ${parsedResponse.error.message}`);
          throw new Error(`Failed to abort multipart upload: ${parsedResponse.error.message}`);
        }

        return {
          status: 'Aborted',
          key,
          uploadId,
          response: parsedResponse,
        };
      } else {
        this._log('error', `Abort request failed with status ${res.status}`);
        throw new Error(`Abort request failed with status ${res.status}`);
      }
    } catch (error) {
      this._log('error', 'Error aborting multipart upload:' + error);
      throw new Error(`Failed to abort multipart upload for key ${key}: ${error.message}`);
    }
  }

  _buildCompleteMultipartUploadXml(parts) {
    return `
      <CompleteMultipartUpload>
        ${parts
          .map(
            part => `
          <Part>
            <PartNumber>${part.PartNumber}</PartNumber>
            <ETag>${part.ETag}</ETag>
          </Part>
        `,
          )
          .join('')}
      </CompleteMultipartUpload>
    `;
  }

  /**
   * Delete an object from the bucket.
   * @param {string} path - The key of the object to delete.
   * @returns {Promise<Object>} The response from the delete operation.
   */
  async delete(path) {
    const { url, headers: signedHeaders } = await this._sign('DELETE', path, {}, {}, '');
    const res = await this._sendRequest(url, 'DELETE', signedHeaders);
    return res.json();
  }

  async _sendRequest(url, method, headers, body = null) {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: this.requestAbortTimeout !== undefined ? AbortSignal.timeout(this.requestAbortTimeout) : undefined,
    });

    if (!res.ok) {
      await this._handleErrorResponse(res);
    }

    return res;
  }

  async _handleErrorResponse(res) {
    const errorBody = await res.text();
    const errorCode = res.headers.get('x-amz-error-code') || 'Unknown';
    const errorMessage = res.headers.get('x-amz-error-message') || res.statusText;
    this._log('error', `Request failed: ${errorBody}`);
    throw new Error(`Request failed with status ${res.status}: ${errorCode} - ${errorMessage}`);
  }

  _buildCanonicalQueryString(queryParams) {
    if (Object.keys(queryParams).length < 1) {
      return '';
    }

    return Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
  }
  async _getSignatureKey(dateStamp) {
    const kDate = await _hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = await _hmac(kDate, this.region);
    const kService = await _hmac(kRegion, S3_SERVICE);
    return _hmac(kService, AWS_REQUEST_TYPE);
  }
}

const _hash = async content => {
  const hashSum = _createHash('sha256');
  hashSum.update(content);
  return hashSum.digest('hex');
};

const _hmac = async (key, content, encoding) => {
  const hmacSum = _createHmac('sha256', key);
  hmacSum.update(content);
  return hmacSum.digest(encoding);
};

const _parseXml = str => {
  const unescapeXml = value => {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  };

  const json = {};
  const re = /<(\w)([-\w]+)(?:\/|[^>]*>((?:(?!<\1)[\s\S])*)<\/\1\2)>/gm;
  let match;

  while ((match = re.exec(str))) {
    const [, prefix, key, value] = match;
    const fullKey = prefix.toLowerCase() + key;
    const parsedValue = value != null ? _parseXml(value) : true;

    if (typeof parsedValue === 'string') {
      json[fullKey] = unescapeXml(parsedValue); // Apply unescapeXml here
    } else if (Array.isArray(json[fullKey])) {
      json[fullKey].push(parsedValue);
    } else {
      json[fullKey] =
        json[fullKey] != null ? [json[fullKey], parsedValue] : expectArray[fullKey] ? [parsedValue] : parsedValue;
    }
  }

  return Object.keys(json).length ? json : unescapeXml(str); // Also apply unescapeXml here for root text nodes
};

export { S3 };
export default S3;
