# 🪽 ultralight-s3

~15KB lightweight S3 client with zero dependencies, designed for Node.js, edge computing, Cloudflare workers, AWS Lambda (and browsers - not implemented yet).

## Features

- 🚀 Lightweight: Only ~15KB minified
- 🔧 Zero dependencies
- 💻 Works on Node.js, perfect for edge computing, serverless
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
- [API](#api)
- [Community](#community)
- [License](#license)

## Usage

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
const objects = await s3.list('/');
console.log(objects);

// Check if a file exists
const exists = await s3.fileExists('path/to/file.txt');

// Get a life
const data = await s3.get('path/to/life.txt');
console.log(data);

// get a stream of a large file (first chunk)
const firstChunk = await s3.getStream('path/to/large-file.mp4', false, 0);

// get a stream of a large file (all chunks)
const allChunks = await s3.getStream('path/to/large-file.mp4', true);
for await (const chunk of allChunks) {
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
