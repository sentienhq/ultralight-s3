# femto-s3

A turbo lightweight S3 client that doesn't require anything and anyone. Only for the thick-skinned personalities.

- Works on Node, edge, workers, lambda, and browser (NOT IMEPLEMENTED YET)
- Supports only essential S3 APIs (list, put (single and multipart), get (single and stream), delete, etc...)
- No dependencies
- Super lightweight (~12kb minified)

## Installation

```bash
npm install femto-s3

# or

yarn add femto-s3

# or

pnpm add femto-s3

# or
# Not yet implemented
# <script src="https://unpkg.com/femtos3/dist/femto-s3.min.js" defer></script>
```

## Usage

```js
import { S3 } from 'femto-s3';

const s3 = new S3({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  region: 'auto',
  bucket: 'your-bucket-name',
});

const data = await s3.getObject('path/to/file.txt');
console.log(data);
```
