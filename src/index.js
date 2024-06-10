'use strict';

const _hasCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

let _crypto;
let _randomUUID;

if (_hasCrypto) {
  console.log('worker crypto');
  _crypto = crypto;
  _randomUUID = crypto.randomUUID;
} else if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
  console.log('browser crypto');
  _crypto = window.crypto;
  _randomUUID = () => {
    const bytes = new Uint8Array(16);
    _crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
} else {
  console.log('node crypto');
  import('node:crypto').then((nodeCrypto) => {
    _crypto = nodeCrypto;
    _randomUUID = nodeCrypto.randomUUID;
  });
}

export class S3 {
  constructor({ endpoint, accessKeyId, secretAccessKey, region = 'auto', bucketName, cache, retries = 10, initRetryMs = 50 }) {
    this._checkProps({ accessKeyId, secretAccessKey, endpoint });
    this.endpoint = endpoint;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.bucketName = bucketName;
    this.cache = cache || new Map();
    this.retries = retries;
    this.initRetryMs = initRetryMs;
  }

  _checkProps = (props) => {
    if (typeof props.endpoint !== 'string' || props.endpoint.length === 0) throw new TypeError('endpoint must be a non-empty string');
    if (typeof props.accessKeyId !== 'string' || props.accessKeyId.length === 0)
      throw new TypeError('accessKeyId must be a non-empty string');
    if (typeof props.secretAccessKey !== 'string' || props.secretAccessKey.length === 0)
      throw new TypeError('secretAccessKey must be a non-empty string');
  };

  getBucketName = () => {
    return this.bucketName;
  };

  getRegion = () => {
    return this.region;
  };

  getEndpoint = () => {
    return this.endpoint;
  };

  getProps = () => {
    return {
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      bucket: this.bucket,
    };
  };

  hasCrpyto = () => _hasCrypto;
}
