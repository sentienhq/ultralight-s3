# 🪽 ultralight-s3

~15KB lightweight S3 client with zero dependencies, designed for Node.js, edge computing like Cloudflare workers, AWS Lambda (and browsers - not implemented yet).

[![npm package version](https://img.shields.io/npm/v/ultralight-s3)](https://www.npmjs.com/package/ultralight-s3)
![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/ultralight-s3)[![NPM License](https://img.shields.io/npm/l/ultralight-s3)](https://github.com/sentienhq/ultralight-s3/blob/main/LICENSE.md)
[![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/sentienhq/ultralight-s3)](https://github.com/sentienhq/ultralight-s3/issues)
[![GitHub Repo stars](https://img.shields.io/github/stars/sentienhq/ultralight-s3?style=social)](https://github.com/sentienhq/ultralight-s3)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/sentienhq/ultralight-s3/issues)[![CodeQL](https://github.com/sentienhq/ultralight-s3/actions/workflows/github-code-scanning/codeql/badge.svg?branch=dev)](https://github.com/sentienhq/ultralight-s3/actions/workflows/github-code-scanning/codeql)

Dev:
[![Test Runner](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-cf-dev.yml/badge.svg)](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-cf-dev.yml)
[![Test Runner](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-minio-dev.yml/badge.svg)](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-minio-dev.yml)

Release:
[![Test Runner](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-cf-release.yml/badge.svg)](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-cf-release.yml)
[![Test Runner](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-minio-release.yml/badge.svg)](https://github.com/sentienhq/ultralight-s3/actions/workflows/test-runner-minio-release.yml)

## Features

- 🚀 Lightweight: Only ~16KB minified
- 🔧 Zero dependencies
- 💻 Works on NodeJS, Cloudflare workers, ideal for edge computing (browser support - not implemented yet)
- 🔑 Supports essential S3 APIs (list, put, get, delete and a few more)
- 🔁 Streaming support & multipart uploads for large files
- 📦 Bring your own S3 bucket

## Table of Contents

- [Features](#features)
- [Usage & examples](#usage--examples)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Minio](#minio) ✅
  - [Cloudflare R2](#cloudflare-r2) ✅
  - [AWS Lambda](#others)
  - [Google Cloud](#others)
  - [Azure](#others)
  - [Ceph](#others)
  - [Others](#others)
- [Public functions](#public-functions)
- [API](#api)
- [Community](#community)
- [License](#license)

## Simple usage

```typescript
import { S3 } from 'ultralight-s3';

// ... your configuration
const s3 = new S3({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  region: 'auto',
  bucket: 'your-bucket-name',
});

// List objects
const objects = await s3.list();
// or with prefix
// const specificObjectsUnderPrefix = await s3.list('/', 'prefix');
console.log(objects);

// Check if a file exists
const exists = await s3.fileExists('path/to/file.txt');

// Get a life
const data = await s3.get('path/to/life.txt');
console.log(data);

// get a stream of a large file (first chunk)
const firstChunk = await s3.getResponse('path/to/large-file.mp4', false, 0).body;

// get a stream of a large file (all chunks)
const allChunks = await s3.getResponse('path/to/large-file.mp4', true);
for await (const chunk of allChunks.body) {
  console.log(chunk);
}

// Upload a large file
// by default is 5MB per request (minimum for AWS S3 is 5MB)
const chunkSize = s3.getMaxRequestSizeInBytes();
// Initiate multipart upload
const uploadId = await s3.getMultipartUploadId('randomFileName.fastaq', 'text/plain');
const buffer = randomBytes(chunkSize * 2 + 1024); // Just over 2 parts
const upload = await s3.uploadPart('randomFileName.fastaq', buffer, uploadId, 1);
const upload2 = await s3.uploadPart('randomFileName.fastaq', buffer, uploadId, 2);
const upload3 = await s3.uploadPart('randomFileName.fastaq', buffer, uploadId, 3);

// Complete multipart upload
const result = await s3.completeMultipartUpload('randomFileName.fastaq', uploadId, [
  { partNumber: 1, ETag: upload.ETag },
  { partNumber: 2, ETag: upload2.ETag },
  { partNumber: 3, ETag: upload3.ETag },
]);
console.log(result);

// Get file size
const size = await s3.getContentLength('path/to/file.txt');
console.log(size);

// Put a file
await s3.put('path/to/file.txt', Buffer.from('Hello, World!'));

// Delete a file
await s3.delete('path/to/file.txt');
```

For some examples, check the [dev directory](https://github.com/sentienhq/ultralight-s3/tree/dev/dev) and try to use it with [Hono](https://github.com/honojs/hono) or [Cloudflare Workers](https://workers.cloudflare.com/).

## Installation

```bash
npm install ultralight-s3

# or

yarn add ultralight-s3

# or

pnpm add ultralight-s3

# or
# Not yet implemented
# <script src="https://unpkg.com/ultralight-s3/dist/ultralight-s3.min.js" defer></script>
```

## Configuration

### Minio (✅ tested)

```typescript
import { S3 } from 'ultralight-s3';

const s3 = new S3({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  endpoint: 'https://your-s3-endpoint.com' || 'http://127.0.0.1:9000',
  bucketName: 'your-bucket-name',
  region: 'auto', //optional -  by default is auto
  maxRequestSizeInBytes: 5242880, // optional - by default is 5MB
  requestAbortTimeout: undefined, // optional - for aborting requests
  logger: console, // optional - for debugging
});
```

### Cloudflare R2 (✅ tested)

```typescript
import { S3 } from 'ultralight-s3';

const s3 = new S3({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  endpoint: 'https://your-clouflare-id.r2.cloudflarestorage.com/your-bucket-name',
  bucketName: 'your-bucket-name',
  region: 'auto', //optional -  by default is auto
  maxRequestSizeInBytes: 5242880, // optional - by default is 5MB
  requestAbortTimeout: undefined, // optional - for aborting requests
  logger: console, // optional - for debugging
});
```

### Others

##### (AWS Lambda, Azure, Google Cloud, Ceph, etc)

Not tested, but should work with other S3 compatible services. Full list - soon to come. PRs are welcome.

## Public functions

### Bucket Operations

- [`bucketExists()`](#bucketexists): Check if a bucket exists.
- [`createBucket()`](#createbucket): Create a new bucket.

### Object Operations

- [`get(key, opts)`](#get): Get an object from the bucket
- [`getObjectWithETag(key, opts)`](#getobjectwithetag): Get an object and its ETag from the bucket
- [`getEtag(key, opts)`](#getetag): Get the ETag of an object
- [`getResponse(key, wholeFile, rangeFrom, rangeTo, opts)`](#getresponse): Get a response of an object from the bucket
- [`put(key, data)`](#put): Put an object into the bucket
- [`delete(key)`](#delete): Delete an object from the bucket
- [`getContentLength(key)`](#getcontentlength): Get the content length of an object
- [`fileExists(key)`](#fileexists): Check if an object exists in the bucket

### Listing Operations

- [`list(delimiter, prefix, maxKeys, method, opts)`](#list): List objects in the bucket
- [`listMultiPartUploads(delimiter, prefix, method, opts)`](#listmultipartuploads): List multipart uploads in the bucket

### Multipart Upload Operations

- [`getMultipartUploadId(key, fileType)`](#getmultipartuploadid): Initiate a multipart upload
- [`uploadPart(key, data, uploadId, partNumber, opts)`](#uploadpart): Upload a part in a multipart upload
- [`completeMultipartUpload(key, uploadId, parts)`](#completemultipartupload): Complete a multipart upload
- [`abortMultipartUpload(key, uploadId)`](#abortmultipartupload): Abort a multipart upload

### Configuration and Utility Methods

- `getBucketName()`: Get the current bucket name
- `setBucketName(bucketName)`: Set the bucket name
- `getRegion()`: Get the current region
- `setRegion(region)`: Set the region
- `getEndpoint()`: Get the current endpoint
- `setEndpoint(endpoint)`: Set the endpoint
- `getMaxRequestSizeInBytes()`: Get the maximum request size in bytes
- `setMaxRequestSizeInBytes(maxRequestSizeInBytes)`: Set the maximum request size in bytes
- `sanitizeETag(etag)`: Sanitize an ETag string
- `getProps()`: Get all configuration properties
- `setProps(props)`: Set all configuration properties

## API

**new S3(config: Object)**

- **Input**: A configuration object with the following properties:
  - `accessKeyId: string`: The access key ID for authentication.
  - `secretAccessKey: string`: The secret access key for authentication.
  - `endpoint: string`: The endpoint URL of the S3-compatible service.
  - `bucketName: string`: The name of the bucket to operate on.
  - `region?: string` (optional): The region of the S3 service (default: 'auto').
  - `maxRequestSizeInBytes?: number` (optional): The maximum size of a single request in bytes (minimum 5MB).
  - `requestAbortTimeout?: number` (optional): The timeout in milliseconds after which a request should be aborted.
  - `logger?: Object` (optional): A logger object with methods like info, warn, error.
- **Behavior**: Creates a new instance of the S3 class with the provided configuration.
- **Returns**: S3: An instance of the S3 class.

<a id="list"></a>
**list(delimiter?: string, prefix?: string, maxKeys?: number, method?: string, opts?: Object): Promise<Array<Object\>**

- **Input**:
  - `delimiter?: string` (optional): The delimiter to use for grouping objects in specific path (default: '/').
  - `prefix?: string` (optional): The prefix to filter objects in specific path (default: '').
  - `maxKeys?: number` (optional): The maximum number of keys to return (default: 1000).
  - `method?: string` (optional): The HTTP method to use (default: 'GET').
  - `opts?: Object` (optional): Additional options for the list operation.
- **Behavior**: Lists objects in the bucket, supporting pagination and filtering.
- **Returns**: Promise<Array<Object\>: A promise that resolves to an array of objects or object metadata.

<a id="put"></a>
**put(key: string, data: Buffer | string): Promise<Object\>**

- **Input**:
  - `key: string`: The key of the object to put.
  - `data: Buffer | string`: The content of the object.
- **Behavior**: Uploads an object to the bucket.
- **Returns**: Promise<Object\>: A promise that resolves to the response from the put operation.

<a id="get"></a>
**get(key: string, opts?: Object): Promise<string>**

- **Input**:
  - `key: string`: The key of the object to get.
  - `opts?: Object` (optional): Additional options for the get operation.
- **Behavior**: Retrieves an object from the bucket.
- **Returns**: Promise<string | null>: A promise that resolves to the content of the object or null if the object doesn't exist or there's an ETag mismatch.

<a id="getobjectwithetag"></a>
**getObjectWithETag(key: string, opts?: Object): Promise<{ etag: string | null; data: string | null }>**

- **Input**:
  - `key: string`: The key of the object to get.
  - `opts?: Object` (optional): Additional options for the get operation.
- **Behavior**: Retrieves an object and its ETag from the bucket.
- **Returns**: Promise<{ etag: string | null; data: string | null }>: A promise that resolves to an object containing the ETag and content of the object, or null values if the object doesn't exist or there's an ETag mismatch.

<a id="getresponse"></a>
**getResponse(key: string, wholeFile?: boolean, rangeFrom?: number, rangeTo?: number, opts?: Object): Promise<Response\>**

- **Input**:
  - `key: string`: The key of the object to get.
  - `wholeFile?: boolean` (optional): Whether to get the whole file or a part (default: true).
  - `rangeFrom?: number` (optional): The byte range from to get if not getting the whole file (default: 0).
  - `rangeTo?: number` (optional): The byte range to to get if not getting the whole file (default: maxRequestSizeInBytes). Note: rangeTo is inclusive.
  - `opts?: Object` (optional): Additional options for the get operation.
- **Behavior**: Retrieves a response of an object from the bucket.
- **Returns**: Promise<Response\>: A promise that resolves to a Response of the object content. Use readableStream() to get the stream from .body.

<a id="getetag"></a>
**getEtag(key: string, opts?: Object): Promise<string | null>**

- **Input**:
  - `key: string`: The key of the object to get the ETag for.
  - `opts?: Object` (optional): Additional options for the operation.
- **Behavior**: Retrieves the ETag of an object from the bucket.
- **Returns**: Promise<string | null>: A promise that resolves to the ETag of the object or null if the ETag doesn't match the provided conditions.

<a id="delete"></a>
**delete(key: string): Promise<boolean>**

- **Input**: `key: string`: The key of the object to delete.
- **Behavior**: Deletes an object from the bucket.
- **Returns**: Promise<bollean\>: A promise that resolves to true if the delete operation was successful, false otherwise. ⚠️ Note: Delete will NOT return false if the object does not exist. Use fileExists() to check if an object exists before/after deleting it.

<a id="fileexists"></a>
**fileExists(key: string): Promise<ExistResponseCode>**

- **Input**: `key: string`: The key of the object to check.
- **Behavior**: Checks if an object exists in the bucket.
- **Returns**: Promise<ExistResponseCode>: A promise that resolves to a value indicating the existence status: false (not found), true (found), or null (ETag mismatch).

<a id="getcontentlength"></a>
**getContentLength(key: string): Promise<number\>**

- **Input**: `key: string`: The key of the object.
- **Behavior**: Gets the content length of an object.
- **Returns**: Promise<number\>: A promise that resolves to the content length of the object in bytes.

<a id="listmultipartuploads"></a>
**listMultiPartUploads(delimiter?: string, prefix?: string, method?: string, opts?: Object): Promise<Array<Object\>**

- **Input**:
  - `delimiter?: string` (optional): The delimiter to use for grouping objects in specific path (default: '/').
  - `prefix?: string` (optional): The prefix to filter objects in specific path (default: '').
  - `method?: string` (optional): The HTTP method to use (default: 'GET').
  - `opts?: Object` (optional): Additional options for the list operation.
- **Behavior**: Lists multipart uploads in the bucket.
- **Returns**: Promise<Array<Object\>: A promise that resolves to an array of multipart uploads or multipart upload metadata.

<a id="getmultipartuploadid"></a>
**getMultipartUploadId(key: string, fileType?: string): Promise<string>**

- **Input**:
  - `key: string`: The key of the object to upload.
  - `fileType?: string` (optional): The MIME type of the file (default: 'application/octet-stream').
- **Behavior**: Initiates a multipart upload.
- **Returns**: Promise<string\>: A promise that resolves to the upload ID for the multipart upload.

<a id="uploadpart"></a>
**uploadPart(key: string, data: Buffer | string, uploadId: string, partNumber: number, opts?: Object): Promise<{ partNumber: number, ETag: string }>**

- **Input**:
  - `key: string`: The key of the object being uploaded.
  - `data: Buffer | string`: The content of the part.
  - `uploadId: string`: The upload ID of the multipart upload.
  - `partNumber: number`: The part number.
  - `opts?: Object` (optional): Additional options for the upload.
- **Behavior**: Uploads a part in a multipart upload.
- **Returns**: Promise<{ partNumber: number, ETag: string }>: A promise that resolves to an object containing the ETag and part number of the uploaded part.

<a id="completemultipartupload"></a>
**completeMultipartUpload(key: string, uploadId: string, parts: Array<{ partNumber: number, ETag: string }>): Promise<Object\>**

- **Input**:
  - `key: string`: The key of the object being uploaded.
  - `uploadId: string`: The upload ID of the multipart upload.
  - `parts: Array<{ partNumber: number, ETag: string }>`: An array of objects containing PartNumber and ETag for each part.
- **Behavior**: Completes a multipart upload.
- **Returns**: Promise<Object\>: A promise that resolves to the result of the complete multipart upload operation.

<a id="abortmultipartupload"></a>
**abortMultipartUpload(key: string, uploadId: string): Promise<Object\>**

- **Input**:
  - `key: string`: The key of the object being uploaded.
  - `uploadId: string`: The ID of the multipart upload to abort.
- **Behavior**: Aborts a multipart upload.
- **Returns**: Promise<Object\>: A promise that resolves to the abort response.

<span id="createbucket"></span>
**createBucket(): Promise<boolean\>**

- **Behavior**: Creates a new bucket.
- **Returns**: Promise<boolean>: A promise that resolves to a boolean indicating whether the bucket creation was successful.

<span id="bucketexists"></span>
**bucketExists(): Promise<boolean\>**

- **Behavior**: Checks if the configured bucket exists.
- **Returns**: Promise<boolean>: A promise that resolves to a boolean indicating whether the bucket exists.

<span id="sanitizeetag"></span>
**sanitizeETag(etag: string): string**

- **Input**: `etag: string`: The ETag to sanitize.
- **Behavior**: Removes surrounding quotes and HTML entities from the ETag.
- **Returns**: string: The sanitized ETag.

Also all essential getters and setters for the config object.

## Community

Stay connected with the community and get support.

- [Issues](https://github.com/sentienhq/ultralight-s3/issues): Report bugs or request features
- [GH Discussions](https://github.com/sentienhq/ultralight-s3/discussions): Ask questions and share ideas
- X/Twitter: [@SentienHQ](https://x.com/sentienhq)
- Webbsite: [sentienhq.com](https://sentienhq.com)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
