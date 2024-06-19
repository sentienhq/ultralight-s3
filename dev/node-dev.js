import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { env } from 'node:process';

import avro from 'avro-js';

import { JSONParseStream } from '@worker-tools/json-stream';

import { S3 } from '../lib/index.js';
const app = new Hono();

console.log('Node is running!');
console.log('avro', avro);
const configCFS3 = {
  endpoint: env.ENDPOINT,
  region: env.REGION,
  accessKeyId: env.ACCESS_KEY_ID,
  secretAccessKey: env.SECRET_ACCESS_KEY,
  bucketName: env.BUCKET_NAME,
};

app.get('/', async c => {
  const s3 = new S3(configCFS3);
  const s3list = await s3.list();
  const collected = [];

  // const jsonStream = s3.getStream(s3list[0].key).body;
  await (await s3.getStream(s3list[0].key)).pipeThrough(new JSONParseStream('$.*')).pipeTo(
    new WritableStream({
      write(obj) {
        collected.push(obj);
      },
    }),
  );
  console.log('Collected objects:', collected);
  return c.json([]);
});

serve(app);
