'use strict';

import { S3 } from '../lib/index.min.js';
import { env } from 'node:process';
import * as Minio from 'minio';
import { randomBytes } from 'crypto';
import stream from 'stream';
import { log } from 'node:console';

let minioTest = true;
const localTestConfig = {
  endpoint: env.ENDPOINT || 'http://127.0.0.1:9000',
  region: env.REGION || 'auto',
  accessKeyId: env.ACCESS_KEY_ID || 'minio_user',
  secretAccessKey: env.SECRET_ACCESS_KEY || 'minio_password',
  bucketName: env.BUCKET_NAME || 'test-bucket',
};

let s3;
let minioClient;

if (localTestConfig.endpoint.includes('127.0.0.1:9000')) {
  console.log('Using Minio config');
  minioClient = new Minio.Client({
    endPoint: '127.0.0.1',
    port: 9000,
    useSSL: false,
    accessKey: localTestConfig.accessKeyId,
    secretKey: localTestConfig.secretAccessKey,
  });
  s3 = new S3({
    endpoint: localTestConfig.endpoint,
    region: localTestConfig.region,
    accessKeyId: localTestConfig.accessKeyId,
    secretAccessKey: localTestConfig.secretAccessKey,
    bucketName: localTestConfig.bucketName,
  });
} else {
  console.log('Using Cloudflare setup');
  minioTest = false;
  minioClient = new Minio.Client({
    endPoint: localTestConfig.endpoint,
    useSSL: true,
    region: 'auto',
    accessKey: localTestConfig.accessKeyId,
    secretKey: localTestConfig.secretAccessKey,
  });
  s3 = new S3({
    endpoint: `https://${localTestConfig.endpoint}`,
    region: localTestConfig.region,
    accessKeyId: localTestConfig.accessKeyId,
    secretAccessKey: localTestConfig.secretAccessKey,
    bucketName: localTestConfig.bucketName,
  });
}

describe('S3 class', () => {
  beforeAll(async () => {
    const exists = await minioClient.bucketExists(localTestConfig.bucketName);
    if (!exists) {
      await minioClient.makeBucket(localTestConfig.bucketName, localTestConfig.region);
      console.log(`Bucket ${localTestConfig.bucketName} created`);
    }
  });

  test('be able to instantiate S3 class', () => {
    expect(s3).toBeDefined();
    expect(s3).toBeInstanceOf(S3);
  });

  test('check if bucket exists', async () => {
    const exists = await s3.bucketExists();
    expect(exists).toBe(true);
  });

  test('check if non existing bucket exists', async () => {
    const nonExistingBucket = 'non-existing-bucket';
    const newConfig = {
      ...localTestConfig,
      bucketName: nonExistingBucket,
      endpoint: minioTest ? localTestConfig.endpoint : `https://${localTestConfig.endpoint}`,
    };
    const news3 = new S3(newConfig);
    const exists = await news3.bucketExists();
    expect(exists).toBe(false);
  });

  test('create non existing bucket', async () => {
    if (minioTest) {
      const reallyNonExistingBucket = 'non-existing-bucket';
      const newConfig = {
        ...localTestConfig,
        bucketName: reallyNonExistingBucket,
        endpoint: localTestConfig.endpoint,
      };
      const checkExists = await minioClient.bucketExists(reallyNonExistingBucket);
      if (checkExists) {
        await minioClient.removeBucket(reallyNonExistingBucket);
      }
      const exists = await minioClient.bucketExists(reallyNonExistingBucket);
      expect(exists).toBe(false);

      const news3 = new S3(newConfig);
      const exists2 = await news3.bucketExists();
      expect(exists2).toBe(false);

      const created = await news3.createBucket();
      expect(created).toBe(true);

      const exists3 = await minioClient.bucketExists(reallyNonExistingBucket);
      expect(exists3).toBe(true);
      if (exists3) {
        await minioClient.removeBucket(reallyNonExistingBucket);
      }
    }
  });

  test('list objects', async () => {
    const testKey = 'list-test-object';
    const testContent = 'List test content';

    await s3.put(testKey, testContent);

    const s3list = await s3.list();
    expect(s3list).toBeInstanceOf(Array);
    expect(s3list.some(item => item.key === testKey)).toBe(true);

    // Verify with Minio client
    const minioList = await new Promise((resolve, reject) => {
      const objects = [];
      minioClient
        .listObjects(localTestConfig.bucketName, '', true)
        .on('data', obj => objects.push(obj))
        .on('error', reject)
        .on('end', () => resolve(objects));
    });
    expect(minioList.some(item => item.name === testKey)).toBe(true);
  });

  test('return ETag when putting an object', async () => {
    const key = 'etag-test-object';
    const content = 'Hello, ETag!';
    const response = await s3.put(key, content);
    const etag = s3.sanitizeETag(response.headers.get('etag') || '');
    expect(etag).toBeDefined();
    expect(typeof etag).toBe('string');

    const getResult = await s3.getObjectWithETag(key);
    expect(getResult.etag).toBe(etag);

    const etagFromDirectGet = await s3.getEtag(key);
    expect(etagFromDirectGet).toBe(etag);
  });

  test('succeed with correct If-Match header', async () => {
    const key = 'if-match-test-object';
    const content = 'Hello, If-Match!';
    const putResponse = await s3.put(key, content);
    const etag = s3.sanitizeETag(putResponse.headers.get('etag'));
    const getResponse = await s3.getObjectWithETag(key, { 'if-match': etag });
    const getEtag = s3.sanitizeETag(getResponse.etag || '');
    expect(getEtag).toBe(etag);
    expect(getResponse.data).toBe(content);
  });

  test('fail with incorrect If-Match header', async () => {
    const key = 'if-match-fail-test-object';
    const content = 'Hello, If-Match Fail!';
    await s3.put(key, content);
    const getResult = await s3.get(key, { 'if-match': '"incorrect-etag"' });
    expect(getResult).toBe(null);
  });

  test('succeed with correct If-None-Match header', async () => {
    const key = 'if-none-match-test-object';
    const content = 'Hello, If-None-Match!';
    await s3.put(key, content);
    const getContent = await s3.get(key, { 'if-none-match': '"incorrect-etag"' });
    const getContentText = await getContent.text();
    expect(getContentText).toBe(content);
  });

  test('return null with matching If-None-Match header', async () => {
    const key = 'if-none-match-null-test-object';
    const content = 'Hello, If-None-Match Null!';
    const putResult = await s3.put(key, content);
    const etag = putResult.headers.get('etag');
    const getContent = await s3.get(key, { 'if-none-match': etag });
    expect(getContent).toBe(null);
  });

  test('handle ETag for multipart uploads', async () => {
    const key = 'multipart-etag-test';
    const partSize = 5 * 1024 * 1024; // 5MB
    const numberOfParts = 3;
    const buffer = randomBytes(partSize * numberOfParts); // Exactly 3 parts

    const uploadId = await s3.getMultipartUploadId(key);
    const uploadPromises = [];
    for (let i = 0; i < numberOfParts; i++) {
      const start = i * partSize;
      const end = (i + 1) * partSize;
      uploadPromises.push(s3.uploadPart(key, buffer.subarray(start, end), uploadId, i + 1));
    }

    const uploadResults = await Promise.all(uploadPromises);

    const parts = uploadResults.map((result, index) => ({
      partNumber: index + 1,
      ETag: result.ETag,
    }));

    const result = await s3.completeMultipartUpload(key, uploadId, parts);

    // const etag = result.headers.get('etag');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');

    const etag = result.eTag;
    expect(etag).toBeDefined();
    expect(typeof etag).toBe('string');

    const getResult = await s3.getObjectWithETag(key);
    expect(getResult.etag).toBe(etag);
  });

  test('list objects with prefix', async () => {
    const testKey = 'list-test-object';
    const testContent = 'List test content';

    await s3.put(testKey, testContent);

    const s3list = await s3.list('/', 'list-test');
    expect(s3list).toBeInstanceOf(Array);
    expect(s3list.length).toBe(1);
    expect(s3list.some(item => item.key === testKey)).toBe(true);

    // Verify with Minio client
    const minioList = await new Promise((resolve, reject) => {
      const objects = [];
      minioClient
        .listObjects(localTestConfig.bucketName, 'list-test', true)
        .on('data', obj => objects.push(obj))
        .on('error', reject)
        .on('end', () => resolve(objects));
    });
    // check exact match of key and quantity
    expect(minioList.length).toBe(1);
    expect(minioList.some(item => item.name === testKey)).toBe(true);
  });

  test('put and get an object', async () => {
    const key = 'test-object';
    const content = 'Hello, World!';

    await s3.put(key, content);
    const retrievedContent = await s3.get(key);
    const retrievedContentText = await retrievedContent.text();

    expect(retrievedContentText).toBe(content);

    // Verify with Minio client
    const minioContent = await new Promise((resolve, reject) => {
      let data = '';
      minioClient.getObject(localTestConfig.bucketName, key, (err, dataStream) => {
        if (err) reject(err);
        dataStream.on('data', chunk => (data += chunk));
        dataStream.on('end', () => resolve(data));
        dataStream.on('error', reject);
      });
    });
    expect(minioContent).toBe(content);
  });

  test('check if a file exists', async () => {
    const key = 'existing-file';
    await s3.put(key, 'This file exists');

    const exists = await s3.fileExists(key);
    expect(exists).toBe(true);

    // Verify with Minio client
    const minioExists = await minioClient
      .statObject(localTestConfig.bucketName, key)
      .then(() => true)
      .catch(() => false);
    expect(minioExists).toBe(true);

    const nonExistentKey = 'non-existent-file';
    const nonExistentExists = await s3.fileExists(nonExistentKey);
    expect(nonExistentExists).toBe(false);

    // Verify with Minio client
    const minioNonExistentExists = await minioClient
      .statObject(localTestConfig.bucketName, nonExistentKey)
      .then(() => true)
      .catch(() => false);
    expect(minioNonExistentExists).toBe(false);
  });

  test('delete an object', async () => {
    const key = 'to-be-deleted';
    await s3.put(key, 'This will be deleted');

    const exists1 = await s3.fileExists(key);
    expect(exists1).toBe(true);

    await s3.delete(key);

    const exists = await s3.fileExists(key);
    expect(exists).toBe(false);

    // Verify with Minio client
    const minioExists = await minioClient
      .statObject(localTestConfig.bucketName, key)
      .then(() => true)
      .catch(() => false);
    expect(minioExists).toBe(false);
  });

  test('get content length', async () => {
    const key = 'content-length-test';
    const content = 'This is a test content';
    await s3.put(key, content);
    const contentLength = await s3.getContentLength(key);
    expect(contentLength).toBe(content.length);

    // Verify with Minio client
    const minioStat = await minioClient.statObject(localTestConfig.bucketName, key);
    expect(minioStat.size).toBe(content.length);
  });

  test('perform multipart upload', async () => {
    const key = 'multipart-test';
    const partSize = 5 * 1024 * 1024; // minimum is 5MB per request
    const buffer = randomBytes(partSize * 2 + 1024); // Just over 2 parts

    const uploadId = await s3.getMultipartUploadId(key);
    expect(uploadId).toBeTruthy();

    const part1 = buffer.subarray(0, partSize);
    const part2 = buffer.subarray(partSize, partSize * 2);
    const part3 = buffer.subarray(partSize * 2);

    const [upload1, upload2, upload3] = await Promise.all([
      s3.uploadPart(key, part1, uploadId, 1),
      s3.uploadPart(key, part2, uploadId, 2),
      s3.uploadPart(key, part3, uploadId, 3),
    ]);

    const result = await s3.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, ETag: upload1.ETag },
      { partNumber: 2, ETag: upload2.ETag },
      { partNumber: 3, ETag: upload3.ETag },
    ]);

    expect(result).toBeTruthy();

    const uploadedContentLength = await s3.getContentLength(key);

    expect(uploadedContentLength).toBe(buffer.length);

    // Verify with Minio client
    const minioContent = await new Promise((resolve, reject) => {
      let data = Buffer.alloc(0);
      minioClient.getObject(localTestConfig.bucketName, key, (err, dataStream) => {
        if (err) reject(err);
        dataStream.on('data', chunk => {
          data = Buffer.concat([data, chunk]);
        });
        dataStream.on('end', () => resolve(data));
        dataStream.on('error', reject);
      });
    });
    expect(minioContent.length).toBe(buffer.length);
    expect(minioContent.equals(buffer)).toBe(true);
  });

  test('abort multipart upload', async () => {
    const key = 'abort-multipart-test';
    const uploadId = await s3.getMultipartUploadId(key);

    await s3.abortMultipartUpload(key, uploadId);

    // Trying to complete the aborted upload should throw an error
    await expect(s3.completeMultipartUpload(key, uploadId, [])).rejects.toThrow();

    // Verify with Minio client that the object doesn't exist
    const minioExists = await minioClient
      .statObject(localTestConfig.bucketName, key)
      .then(() => true)
      .catch(() => false);
    expect(minioExists).toBe(false);
  });

  test('get a stream', async () => {
    const key = 'stream-test';
    const content = 'This is a test for streaming';
    await s3.put(key, content);

    const s3stream = await s3.getResponse(key);
    expect(s3stream.body).toBeTruthy();

    let streamContent = [];
    for await (const chunk of s3stream.body) {
      // convert Buffer bytes to string
      streamContent.push(Buffer.from(chunk));
    }
    const streamContentString = Buffer.concat(streamContent).toString('utf-8');
    expect(streamContentString).toBe(content);

    // try ranged request
    const s3streamRange = await s3.getResponse(key, false, 0, 7);
    expect(s3streamRange.body).toBeTruthy();
    let streamContentRange = [];
    for await (const chunk of s3streamRange.body) {
      // convert Buffer bytes to string
      streamContentRange.push(Buffer.from(chunk));
    }
    const streamContentStringRange = Buffer.concat(streamContentRange).toString('utf-8');
    expect(streamContentStringRange).toBe(content.slice(0, 7));

    // Verify with Minio client
    const minioStream = await new Promise((resolve, reject) => {
      minioClient.getObject(localTestConfig.bucketName, key, (err, dataStream) => {
        if (err) reject(err);
        resolve(dataStream);
      });
    });
    let minioContent = '';
    for await (const chunk of minioStream) {
      minioContent += chunk.toString();
    }
    expect(minioContent).toBe(content);
  });

  test('handle special characters in object keys', async () => {
    const key = 'special!@#$%^&*()_+{}[]|;:,.<>?`~-characters';
    const content = 'Content with special characters: áéíóú';
    const mPut = await minioClient.putObject(localTestConfig.bucketName, key, content);
    const mStat = await minioClient.statObject(localTestConfig.bucketName, key);
    const minioContent = await new Promise((resolve, reject) => {
      let data = '';
      minioClient.getObject(localTestConfig.bucketName, key, (err, dataStream) => {
        if (err) reject(err);
        dataStream.on('data', chunk => (data += chunk));
        dataStream.on('end', () => resolve(data));
        dataStream.on('error', reject);
      });
    });
    expect(minioContent).toBe(content);
    await minioClient.removeObject(localTestConfig.bucketName, key);

    await s3.put(key, content);
    const contentLength = await s3.getContentLength(key);
    expect(contentLength).toBe(Buffer.byteLength(content));

    const retrievedContent = await s3.get(key);
    const retrievedContentText = await retrievedContent.text();
    expect(retrievedContentText).toBe(content);

    expect(retrievedContentText).toBe(minioContent);

    const exists = await s3.fileExists(key);
    expect(exists).toBe(true);

    await s3.delete(key);
    const existsAfterDelete = await s3.fileExists(key);
    expect(existsAfterDelete).toBe(false);
  });

  // Error handling: Invalid credentials
  test('fail operations with invalid credentials', async () => {
    const invalidS3 = new S3({
      endpoint: s3.getEndpoint(),
      accessKeyId: 'invalidAccessKey',
      secretAccessKey: 'invalidSecretKey',
      bucketName: s3.getBucketName(),
    });

    await expect(invalidS3.list()).rejects.toThrow();
    await expect(invalidS3.put('test-key', 'content')).rejects.toThrow();
  });

  // Error handling: Non-existent objects
  test('handle non-existent objects correctly', async () => {
    const nonExistentKey = 'non-existent-object';

    const nonExistentObject = await s3.get(nonExistentKey);
    expect(nonExistentObject).toBe(null);

    const exists = await s3.fileExists(nonExistentKey);
    expect(exists).toBe(false);
  });

  // Error handling: Invalid input parameters
  test('throw error for invalid input parameters', async () => {
    await expect(s3.put('', 'content')).rejects.toThrow(TypeError);
    await expect(s3.get('')).rejects.toThrow(TypeError);
    await expect(s3.delete('')).rejects.toThrow(TypeError);
    await expect(s3.getContentLength('')).rejects.toThrow(TypeError);
    await expect(s3.fileExists('')).rejects.toThrow(TypeError);
    await expect(s3.list('', '', -1)).rejects.toThrow(TypeError);
    await expect(s3.getMultipartUploadId('')).rejects.toThrow(TypeError);
    await expect(s3.uploadPart('', Buffer.from(''), '', 0)).rejects.toThrow(TypeError);
    await expect(s3.completeMultipartUpload('', '', [])).rejects.toThrow(TypeError);
    await expect(s3.abortMultipartUpload('', '')).rejects.toThrow(TypeError);
  });

  test('handle empty files correctly', async () => {
    const key = 'empty-file';
    const content = '';

    await s3.put(key, content);
    const retrievedContent = await s3.get(key);
    const retrievedContentText = await retrievedContent.text();
    expect(retrievedContentText).toBe(content);

    const contentLength = await s3.getContentLength(key);
    expect(contentLength).toBe(0);

    await s3.delete(key);
  });

  // Concurrent operations: Race conditions in multipart uploads
  test('handle concurrent multipart uploads correctly', async () => {
    const key = 'concurrent-multipart-test';
    const partSize = 5 * 1024 * 1024; // 5MB
    const buffer = randomBytes(partSize * 3); // 15MB total

    const uploadId = await s3.getMultipartUploadId(key);

    const uploadParts = async (start, end, partNumber) => {
      const part = buffer.subarray(start, end);
      return s3.uploadPart(key, part, uploadId, partNumber);
    };

    const [upload1, upload2, upload3] = await Promise.all([
      uploadParts(0, partSize, 1),
      uploadParts(partSize, partSize * 2, 2),
      uploadParts(partSize * 2, partSize * 3, 3),
    ]);

    const result = await s3.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, ETag: upload1.ETag },
      { partNumber: 2, ETag: upload2.ETag },
      { partNumber: 3, ETag: upload3.ETag },
    ]);

    expect(result).toBeTruthy();

    const uploadedContentLength = await s3.getContentLength(key);
    expect(uploadedContentLength).toBe(buffer.length);

    await s3.delete(key);
  });

  // Pagination: Large number of objects
  // TODO - FIX THIS TEST
  // test('handle pagination correctly for large number of objects', async () => {
  //   const prefix = 'pagination-test-';
  //   const objectCount = 1050; // More than default max keys (1000)

  //   // Create test objects
  //   for (let i = 0; i < objectCount; i++) {
  //     await s3.put(`${prefix}${i.toString().padStart(4, '0')}`, `Content ${i}`);
  //   }

  //   let allObjects = [];
  //   let marker = '';
  //   do {
  //     const result = await s3.list('', prefix, 1000, 'GET', { marker });
  //     allObjects = allObjects.concat(result);
  //     if (result.length > 0) {
  //       marker = result[result.length - 1].key;
  //     }
  //   } while (allObjects.length < objectCount);

  //   expect(allObjects.length).toBe(objectCount);

  //   // Clean up test objects
  //   for (const obj of allObjects) {
  //     await s3.delete(obj.key);
  //   }
  // });

  // test to clean up after tests
  afterAll(async () => {
    await s3.delete('test-object');
    await s3.delete('test-folder');
    await s3.delete('empty-file');
    await s3.delete('special!@#$%^&*()_+{}[]|;:,.<>?`~-characters');
    await s3.delete('multipart-test');
    await s3.delete('concurrent-multipart-test');
    await s3.delete('stream-test');
    await s3.delete('abort-multipart-test');
    await s3.delete('list-test-object');
    await s3.delete('delete-upload-test');
    await s3.delete('make-folder-test');
  });
});
