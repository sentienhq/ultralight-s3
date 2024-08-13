'use strict';

import { S3 } from '../lib/index.min.js';
import * as Minio from 'minio';
import { randomBytes } from 'crypto';
import stream from 'stream';

const testConfigR2 = {
  useSSL: false,
  endpoint: '127.0.0.1',
  port: 9000,
  region: 'auto',
  accessKeyId: 'minio_user',
  secretAccessKey: 'minio_password',
  bucketName: 'test-bucket',
};

const s3 = new S3({
  endpoint: `${testConfigR2.useSSL ? 'https://' : 'http://'}${testConfigR2.endpoint}:${testConfigR2.port}`,
  accessKeyId: testConfigR2.accessKeyId,
  secretAccessKey: testConfigR2.secretAccessKey,
  bucketName: testConfigR2.bucketName,
  logger: console,
});

const minioClient = new Minio.Client({
  endPoint: testConfigR2.endpoint,
  port: testConfigR2.port,
  useSSL: false,
  accessKey: testConfigR2.accessKeyId,
  secretKey: testConfigR2.secretAccessKey,
});

describe('S3 class', () => {
  beforeAll(async () => {
    const exists = await minioClient.bucketExists(testConfigR2.bucketName);
    if (!exists) {
      await minioClient.makeBucket(testConfigR2.bucketName, testConfigR2.region);
      console.log(`Bucket ${testConfigR2.bucketName} created`);
    }
  });

  test('should be able to instantiate S3 class', () => {
    expect(s3).toBeDefined();
    expect(s3).toBeInstanceOf(S3);
  });

  test('should be able to list objects', async () => {
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
        .listObjects(testConfigR2.bucketName, '', true)
        .on('data', obj => objects.push(obj))
        .on('error', reject)
        .on('end', () => resolve(objects));
    });
    expect(minioList.some(item => item.name === testKey)).toBe(true);
  });

  test('should be able to list objects with prefix', async () => {
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
        .listObjects(testConfigR2.bucketName, 'list-test', true)
        .on('data', obj => objects.push(obj))
        .on('error', reject)
        .on('end', () => resolve(objects));
    });
    // check exact match of key and quantity
    expect(minioList.length).toBe(1);
    expect(minioList.some(item => item.name === testKey)).toBe(true);
  });

  test('should be able to put and get an object', async () => {
    const key = 'test-object';
    const content = 'Hello, World!';

    await s3.put(key, content);
    const retrievedContent = await s3.get(key);

    expect(retrievedContent).toBe(content);

    // Verify with Minio client
    const minioContent = await new Promise((resolve, reject) => {
      let data = '';
      minioClient.getObject(testConfigR2.bucketName, key, (err, dataStream) => {
        if (err) reject(err);
        dataStream.on('data', chunk => (data += chunk));
        dataStream.on('end', () => resolve(data));
        dataStream.on('error', reject);
      });
    });
    expect(minioContent).toBe(content);
  });

  test('should be able to check if a file exists', async () => {
    const key = 'existing-file';
    await s3.put(key, 'This file exists');

    const exists = await s3.fileExists(key);
    expect(exists).toBe(true);

    // Verify with Minio client
    const minioExists = await minioClient
      .statObject(testConfigR2.bucketName, key)
      .then(() => true)
      .catch(() => false);
    expect(minioExists).toBe(true);

    const nonExistentKey = 'non-existent-file';
    const nonExistentExists = await s3.fileExists(nonExistentKey);
    expect(nonExistentExists).toBe(false);

    // Verify with Minio client
    const minioNonExistentExists = await minioClient
      .statObject(testConfigR2.bucketName, nonExistentKey)
      .then(() => true)
      .catch(() => false);
    expect(minioNonExistentExists).toBe(false);
  });

  test('should be able to delete an object', async () => {
    const key = 'to-be-deleted';
    await s3.put(key, 'This will be deleted');

    const exists1 = await s3.fileExists(key);
    expect(exists1).toBe(true);

    await s3.delete(key);

    const exists = await s3.fileExists(key);
    expect(exists).toBe(false);

    // Verify with Minio client
    const minioExists = await minioClient
      .statObject(testConfigR2.bucketName, key)
      .then(() => true)
      .catch(() => false);
    expect(minioExists).toBe(false);
  });

  test('should be able to get content length', async () => {
    const key = 'content-length-test';
    const content = 'This is a test content';
    await s3.put(key, content);
    const contentLength = await s3.getContentLength(key);
    expect(contentLength).toBe(content.length);

    // Verify with Minio client
    const minioStat = await minioClient.statObject(testConfigR2.bucketName, key);
    expect(minioStat.size).toBe(content.length);
  });

  test('should be able to perform multipart upload', async () => {
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
      minioClient.getObject(testConfigR2.bucketName, key, (err, dataStream) => {
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

  test('should be able to abort multipart upload', async () => {
    const key = 'abort-multipart-test';
    const uploadId = await s3.getMultipartUploadId(key);

    await s3.abortMultipartUpload(key, uploadId);

    // Trying to complete the aborted upload should throw an error
    await expect(s3.completeMultipartUpload(key, uploadId, [])).rejects.toThrow();

    // Verify with Minio client that the object doesn't exist
    const minioExists = await minioClient
      .statObject(testConfigR2.bucketName, key)
      .then(() => true)
      .catch(() => false);
    expect(minioExists).toBe(false);
  });

  test('should be able to get a stream', async () => {
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
      minioClient.getObject(testConfigR2.bucketName, key, (err, dataStream) => {
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

  test('should handle special characters in object keys', async () => {
    const key = 'special!@#$%^&*()_+{}[]|;:,.<>?`~-characters';
    const content = 'Content with special characters: áéíóú';
    const mPut = await minioClient.putObject(testConfigR2.bucketName, key, content);
    const mStat = await minioClient.statObject(testConfigR2.bucketName, key);
    const minioContent = await new Promise((resolve, reject) => {
      let data = '';
      minioClient.getObject(testConfigR2.bucketName, key, (err, dataStream) => {
        if (err) reject(err);
        dataStream.on('data', chunk => (data += chunk));
        dataStream.on('end', () => resolve(data));
        dataStream.on('error', reject);
      });
    });
    expect(minioContent).toBe(content);
    await minioClient.removeObject(testConfigR2.bucketName, key);

    await s3.put(key, content);
    const contentLength = await s3.getContentLength(key);
    expect(contentLength).toBe(Buffer.byteLength(content));

    const retrievedContent = await s3.get(key);
    expect(retrievedContent).toBe(content);

    expect(retrievedContent).toBe(minioContent);

    const exists = await s3.fileExists(key);
    expect(exists).toBe(true);

    await s3.delete(key);
    const existsAfterDelete = await s3.fileExists(key);
    expect(existsAfterDelete).toBe(false);
  });

  // Error handling: Invalid credentials
  test('should fail operations with invalid credentials', async () => {
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
  test('should handle non-existent objects correctly', async () => {
    const nonExistentKey = 'non-existent-object';

    const nonExistentObject = await s3.get(nonExistentKey);
    await expect(nonExistentObject).toBe(null);

    const exists = await s3.fileExists(nonExistentKey);
    expect(exists).toBe(false);
  });

  // Error handling: Invalid input parameters
  test('should throw error for invalid input parameters', async () => {
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

  test('should handle empty files correctly', async () => {
    const key = 'empty-file';
    const content = '';

    await s3.put(key, content);
    const retrievedContent = await s3.get(key);
    expect(retrievedContent).toBe(content);

    const contentLength = await s3.getContentLength(key);
    expect(contentLength).toBe(0);

    await s3.delete(key);
  });

  // Concurrent operations: Race conditions in multipart uploads
  test('should handle concurrent multipart uploads correctly', async () => {
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
  // test('should handle pagination correctly for large number of objects', async () => {
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
