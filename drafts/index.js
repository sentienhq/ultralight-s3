'use strict';

// import lowstorage from '../../lib/lowstorage.js';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

import s3ClaudeClient from './s3-v2.js';

const app = new Hono();

const BUCKET_NAME = 'openproxy-bucket';
// const USER_COL = 'users';

console.log('run');

const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

const config = {
  endpoint: process.env.ENDPOINT,
  region: 'auto',
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_KEY,
  forcePathStyle: true,
  bucketName: BUCKET_NAME,
  protocol: 'https',
  host: process.env.ENDPOINT,
  logger: console,
};

console.log(`CONFIG: ${JSON.stringify(config)}
`);
(async () => {
  // const s3 = new microS3(config);
  const cloudflareR2 = new s3ClaudeClient(config);
  const listObjects = await cloudflareR2.list('/');
  // const listObjects = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
  // show what we have in listObjects
  console.log(`ListObjects: ${JSON.stringify(listObjects)}`);
  if (listObjects.contents.length > 0) {
    const getObject1Info = listObjects.contents[0];
    const getObject1 = await cloudflareR2.get(getObject1Info.key);
    const getObjectJSON = JSON.parse(getObject1);
    console.log(`getObject1: ${JSON.stringify(getObjectJSON)}`); // TODO - comment out later
  }

  console.log('=======================================');
  // const s3simple = new simpleS3Client({
  // 	accessKeyId: config.credentials.accessKeyId,
  // 	secretAccessKey: config.credentials.secretAccessKey,
  // 	endpoint: config.endpoint,
  // 	bucketName: BUCKET_NAME,
  // });
  // // show what we have in listObjects

  // const responseSimple = await s3simple.ListObjectsV2Command({ bucketName: BUCKET_NAME });

  // const allColsSimple = responseSimple.Contents.map((col) => col.Key);
  // console.log(`allColsSimple: ${JSON.stringify(allColsSimple)}`);
  // const s3claude = new s3ClaudeClient({
  // 	accessKeyId: config.credentials.accessKeyId,
  // 	secretAccessKey: config.credentials.secretAccessKey,
  // 	endpoint: config.endpoint,
  // 	bucketName: BUCKET_NAME,
  // });
  // const resp = await s3claude.listV2();
  // console.log(`resp: ${JSON.stringify(resp)}`);
})();

app.get('/', async (c) => {
  return c.json({ message: 'Hello World!' });
});

// app.get('/list-collections', async (c) => {
// 	// get all objects from s3
// 	const s3 = new S3Client(config);
// 	const listObjects = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
// 	const response = await s3.send(listObjects);
// 	if (!response.Contents) {
// 		return c.json({ error: 'No content found or access denied' });
// 	}

// 	const allCols = response.Contents.map((col) => col.Key);
// 	return c.json({ allCols });
// });

if (isNode) {
  serve(app);
}
export default app;
