import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { env } from 'node:process';
import S3 from '../lib/index.js';
const app = new Hono();
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
  if (s3list[0].key.indexOf('.json') !== -1) {
    const s3content = await s3.get(s3list[0].key);
    const s3jsonContent = JSON.parse(s3content);
    // add new entry to the json
    const newObj = { name: 'new entry', age: 31 };
    s3jsonContent.push(newObj);
    // upload the new json
    const putResponse = await s3.put(s3list[0].key, JSON.stringify(s3jsonContent));
    // console.log('putResponse', putResponse);
    const s3newContent = await s3.get(s3list[0].key);
    const s3newJsonContent = JSON.parse(s3newContent);
    return c.json(s3newJsonContent);
  }
  // const s3Test = await s3.get({
  // 	path: 's3-test.txt',
  // });
  return c.json(s3list);
});

serve(app);
