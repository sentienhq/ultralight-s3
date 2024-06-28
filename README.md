# ultralight-s3

A ~15KB lightweight S3 client that doesn't require anything and anyone. Only for the thick-skinned personalities.

- Works on Node, edge, workers, lambda, and browser (NOT IMEPLEMENTED YET)
- Supports only essential S3 APIs (list, put (single and multipart), get (single and stream), delete, etc...)
- No dependencies
- Super lightweight (~12kb minified)

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

## Usage

```typescript
import { S3 } from 'ultralight-s3';

const s3 = new S3({
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
  region: 'auto',
  bucket: 'your-bucket-name',
});

const data = await s3.get('path/to/file.txt');
console.log(data);
```
