import { Hono } from 'hono';
// import avro from 'avro-js';

import S3 from '../lib/index.js';

const app = new Hono();
console.log('Worker is running!');

app.get('/', async c => {
  const configCFS3 = {
    endpoint: c.env.ENDPOINT,
    region: c.env.REGION,
    accessKeyId: c.env.ACCESS_KEY_ID,
    secretAccessKey: c.env.SECRET_ACCESS_KEY,
    bucketName: c.env.BUCKET_NAME,
  };
  const s3 = new S3(configCFS3);
  const s3list = await s3.list();
  const collected = [];

  // const jsonStream = s3.getStream(s3list[0].key).body;
  // await (await s3.getStream(s3list[0].key)).pipeThrough(new JSONParseStream('$.*')).pipeTo(
  //   new WritableStream({
  //     write(obj) {
  //       collected.push(obj);
  //     },
  //   }),
  // );
  // console.log('Collected objects:', collected);
  // const s3Test = await s3.get({
  // 	path: 's3-test.txt',
  // });
  return c.json(s3list);
});

export default app;
