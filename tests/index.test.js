'use strict';

import { S3 } from '../lib/index.js';

import * as Minio from 'minio';

const delay = ms => new Promise(res => setTimeout(res, ms));
const testConfigR2 = {
  useSSL: false,
  endpoint: '127.0.0.1',
  port: 9000,
  region: 'auto',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  bucketName: 'test-bucket',
  // forcePathStyle: true,
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
  // forcePathStyle: testConfigR2.forcePathStyle,
});

describe('S3 class', () => {
  test('should be able to instantiate S3 class', async () => {
    const exists = await minioClient.bucketExists(testConfigR2.bucketName);
    if (exists) {
      console.log(`Bucket ${testConfigR2.bucketName} exists`);
    } else {
      await minioClient.makeBucket(testConfigR2.bucketName, testConfigR2.region);
      console.log(`Bucket ${testConfigR2.bucketName} created`);
    }
    // make test wait 10 seconds
    // await delay(10000);
    expect(s3).toBeDefined();
    expect(s3).toBeInstanceOf(S3);
  });

  test('should be able to list objects', async () => {
    const s3 = new S3({
      endpoint: `${testConfigR2.useSSL ? 'https://' : 'http://'}${testConfigR2.endpoint}:${testConfigR2.port}`,
      accessKeyId: testConfigR2.accessKeyId,
      secretAccessKey: testConfigR2.secretAccessKey,
      bucketName: testConfigR2.bucketName,
      logger: console,
    });
    const s3list = await s3.list();
    console.log('s3list ::: ', s3list);
    expect(s3list).toBeInstanceOf(Array);
  });
});
