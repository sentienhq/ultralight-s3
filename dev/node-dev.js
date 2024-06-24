import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { env } from 'node:process';
import { html, raw } from 'hono/html';
// import avro from 'avro-js';

import { S3 } from '../lib/index.js';
const app = new Hono();
console.log('Node is running!');
const configCFS3 = {
  endpoint: env.ENDPOINT,
  region: env.REGION,
  accessKeyId: env.ACCESS_KEY_ID,
  secretAccessKey: env.SECRET_ACCESS_KEY,
  bucketName: env.BUCKET_NAME,
  logger: console,
};

app.post('/upload', async c => {
  const s3 = new S3(configCFS3);
  const body = await c.req.parseBody();
  const file = body['filename'];

  if (file && file instanceof File) {
    const maxFileSizeInB = s3.getMaxRequestSizeInBytes();
    const chunkSize = maxFileSizeInB; // Use max request size as chunk size
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    if (file.size > maxFileSizeInB) {
      try {
        // Initiate multipart upload
        const uploadId = await s3.getMultipartUploadId(file.name, file.type);
        console.log('uploadId', uploadId);

        // Calculate number of parts
        const numParts = Math.ceil(file.size / chunkSize);

        // Function to upload a single part
        const uploadPart = async partNumber => {
          const start = (partNumber - 1) * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = fileBuffer.subarray(start, end);
          return s3.uploadPart(file.name, chunk, uploadId, partNumber);
        };

        // Function to upload parts in batches
        const uploadPartsInBatches = async (totalParts, batchSize) => {
          const parts = [];
          for (let i = 0; i < totalParts; i += batchSize) {
            const batch = Array.from({ length: Math.min(batchSize, totalParts - i) }, (_, index) =>
              uploadPart(i + index + 1),
            );
            const batchResults = await Promise.all(batch);
            parts.push(...batchResults);
            console.log(`Uploaded parts ${i + 1} to ${i + batchResults.length}`);
          }
          return parts;
        };

        // Upload all parts in batches of 10
        const parts = await uploadPartsInBatches(numParts, 10);

        if (!parts || parts.length === 0) {
          throw new Error('No parts were uploaded successfully');
        }

        // Complete multipart upload
        const completeParams = {
          key: file.name,
          uploadId: uploadId,
          parts: parts.map(part => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        };

        const result = await s3.completeMultipartUpload(
          completeParams.key,
          completeParams.uploadId,
          completeParams.parts,
        );
        console.log('Multipart upload completed', result);

        return c.json({ success: true, message: 'Large file uploaded successfully' });
      } catch (error) {
        console.error('Multipart upload failed', error);
        return c.json({ error: 'Multipart upload failed: ' + error.message });
      }
    } else {
      // Small file upload (unchanged)
      console.log('file uploading', file);
      try {
        const resp = await s3.put(file.name, fileBuffer);
        console.log('resp', resp);
        return c.json({ success: true, message: 'Small file uploaded successfully' });
      } catch (error) {
        console.error('Small file upload failed', error);
        return c.json({ error: 'Small file upload failed: ' + error.message });
      }
    }
  }

  return c.json({ error: 'No file provided' });
});

app.get('/del-all', async c => {
  const s3 = new S3(configCFS3);
  const s3list = await s3.list();
  if (s3list.length === 0) {
    return c.json({ success: true, message: 'No objects to delete' });
  }
  for (const file of s3list) {
    console.log('Deleting', file.key);
    const resp = await s3.delete(file.key);
    console.log('resp', resp);
    const fileExist = await s3.fileExists(file.key);
    console.log('fileExist', fileExist);
  }
  return c.json({ success: true });
});

app.get('/list-uploads', async c => {
  const s3 = new S3(configCFS3);
  const s3list = await s3.listMultiPartUploads();
  if (s3list.length === 0) {
    return c.json({ message: 'No uploads found' });
  }
  return c.json(s3list);
});

app.get('/delete-upload/:key', async c => {
  const s3 = new S3(configCFS3);
  const key = c.req.param('key');
  const upload = await s3.listMultiPartUploads();
  if (upload.length === 0) {
    return c.json({ message: 'No uploads found' });
  }
  if (upload.key === key) {
    console.log('Deleting', upload.key, upload.uploadId);
    const resp = await s3.abortMultipartUpload(upload.key, upload.uploadId);
    console.log('resp', resp);
    const fileExist = await s3.fileExists(upload.key);
    console.log('fileExist', fileExist);
    return c.json({ success: true, message: 'Upload deleted successfully' });
  }
  c.json({ message: 'Upload not found' });
});

app.get('/', async c => {
  const s3 = new S3(configCFS3);
  const s3list = await s3.list();
  // const collected = [];

  // const jsonStream = s3.getStream(s3list[0].key).body;
  // await (await s3.getStream(s3list[0].key)).pipeThrough(new JSONParseStream('$.*')).pipeTo(
  //   new WritableStream({
  //     write(obj) {
  //       collected.push(obj);
  //     },
  //   }),
  // );
  // console.log('Collected objects:', collected);
  return c.html(
    html`<!doctype html>
      <html>
        <body>
          <form method="post" action="/upload" enctype="multipart/form-data">
            <input type="file" id="myFile" name="filename" />
            <button type="submit">Upload</button>
          </form>
          ${JSON.stringify(s3list)}
        </body>
      </html>`,
  );
});

serve(app);
