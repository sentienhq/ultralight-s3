interface S3Config {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    bucketName: string;
    region?: string;
    maxRequestSizeInBytes?: number;
    requestAbortTimeout?: number;
    logger?: Logger;
}
declare global {
    interface Crypto {
        createHmac: (algorithm: string, key: string | Buffer) => {
            update: (data: string | Buffer) => void;
            digest: (encoding?: 'hex' | 'base64' | 'latin1') => string;
        };
        createHash: (algorithm: string) => {
            update: (data: string | Buffer) => void;
            digest: (encoding?: 'hex' | 'base64' | 'latin1') => string;
        };
    }
}
interface Logger {
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
}
interface UploadPart {
    partNumber: number;
    ETag: string;
}
interface CompleteMultipartUploadResult {
    Location: string;
    Bucket: string;
    Key: string;
    ETag: string;
}
type HttpMethod = 'POST' | 'GET' | 'HEAD' | 'PUT' | 'DELETE';
/**
 * S3 class for interacting with S3-compatible object storage services.
 * This class provides methods for common S3 operations such as uploading, downloading,
 * and deleting objects, as well as multipart uploads.
 *
 * @class
 * @example
 * const s3 = new S3({
 *   accessKeyId: 'your-access-key',
 *   secretAccessKey: 'your-secret-key',
 *   endpoint: 'https://your-s3-endpoint.com',
 *   bucketName: 'your-bucket-name',
 *   region: 'us-east-1' // by default is auto
 * });
 *
 * // Upload a file
 * await s3.put('example.txt', 'Hello, World!');
 *
 * // Download a file
 * const content = await s3.get('example.txt');
 *
 * // Delete a file
 * await s3.delete('example.txt');
 */
declare class S3 {
    /**
     * Creates an instance of the S3 class.
     *
     * @constructor
     * @param {Object} config - Configuration options for the S3 instance.
     * @param {string} config.accessKeyId - The access key ID for authentication.
     * @param {string} config.secretAccessKey - The secret access key for authentication.
     * @param {string} config.endpoint - The endpoint URL of the S3-compatible service.
     * @param {string} [config.bucketName=''] - The name of the bucket to operate on.
     * @param {string} [config.region='auto'] - The region of the S3 service.
     * @param {number} [config.maxRequestSizeInBytes=5242880] - The maximum size of a single request in bytes (minimum for AWS S3 is 5MB).
     * @param {number} [config.requestAbortTimeout=undefined] - The timeout in milliseconds after which a request should be aborted (careful on streamed requests).
     * @param {Object} [config.logger=null] - A logger object with methods like info, warn, error.
     * @throws {TypeError} Will throw an error if required parameters are missing or of incorrect type.
     */
    private accessKeyId;
    private secretAccessKey;
    private endpoint;
    private bucketName;
    private region;
    private maxRequestSizeInBytes;
    private requestAbortTimeout?;
    private logger?;
    constructor({ accessKeyId, secretAccessKey, endpoint, bucketName, region, maxRequestSizeInBytes, requestAbortTimeout, logger, }: S3Config);
    private _validateConstructorParams;
    private _checkMethodHeadnGet;
    private _checkKey;
    private _checkDelimiter;
    private _checkPrefix;
    private _checkMaxKeys;
    private _checkOpts;
    /**
     * Internal method to log messages with sanitized sensitive information.
     * @param {string} level - The log level (e.g., 'info', 'warn', 'error').
     * @param {string} message - The message to log.
     * @param {Object} [additionalData={}] - Additional data to include in the log.
     * @private
     */
    private _log;
    getBucketName: () => string;
    setBucketName: (bucketName: string) => void;
    getRegion: () => string;
    setRegion: (region: string) => void;
    getEndpoint: () => string;
    setEndpoint: (endpoint: string) => void;
    getMaxRequestSizeInBytes: () => number;
    setMaxRequestSizeInBytes: (maxRequestSizeInBytes: number) => void;
    getProps: () => {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        bucket: string;
        endpoint: string;
        maxRequestSizeInBytes: number;
        requestAbortTimeout: number | undefined;
        logger: Logger | undefined;
    };
    setProps: (props: S3Config) => void;
    /**
     * Get the content length of an object.
     * @param {string} key - The key of the object.
     * @returns {Promise<number>} The content length of the object in bytes.
     * @throws {TypeError} If the key is not a non-empty string.
     */
    getContentLength(key: string): Promise<number>;
    /**
     * Check if a bucket exists.
     * @returns {Promise<boolean>} True if the bucket exists, false otherwise.
     */
    bucketExists(): Promise<boolean>;
    /**
     * Check if a file exists in the bucket.
     * @param {string} key - The key of the object.
     * @returns {Promise<boolean>} True if the file exists, false otherwise.
     * @throws {TypeError} If the key is not a non-empty string.
     */
    fileExists(key: string): Promise<boolean>;
    private _sign;
    private _buildCanonicalHeaders;
    _buildCanonicalRequest(method: HttpMethod, url: URL, query: Object, canonicalHeaders: string, signedHeaders: string, body: string | Buffer): Promise<string>;
    _buildStringToSign(datetime: string, canonicalRequest: string): Promise<string>;
    _calculateSignature(datetime: string, stringToSign: string): Promise<string>;
    private _buildAuthorizationHeader;
    private _filterIfHeaders;
    /**
     * List objects in the bucket.
     * @param {string} [delimiter='/'] - The delimiter to use for grouping objects in specific path.
     * @param {string} [prefix=''] - The prefix to filter objects in specific path.
     * @param {number} [maxKeys=1000] - The maximum number of keys to return.
     * @param {string} [method='GET'] - The HTTP method to use (GET or HEAD).
     * @param {Object} [opts={}] - Additional options for the list operation.
     * @returns {Promise<Object|Array>} The list of objects or object metadata.
     * @throws {TypeError} If any of the parameters are of incorrect type.
     */
    list(delimiter?: string, prefix?: string, maxKeys?: number, method?: HttpMethod, opts?: Object): Promise<Object | Array<Object>>;
    /**
     * List multipart uploads in the bucket.
     * @param {string} [delimiter='/'] - The delimiter to use for grouping objects in specific path.
     * @param {string} [prefix=''] - The prefix to filter objects in specific path.
     * @param {string} [method='GET'] - The HTTP method to use (GET or HEAD).
     * @param {Object} [opts={}] - Additional options for the list operation.
     * @returns {Promise<Object|Array>} The list of objects or object metadata.
     * @throws {TypeError} If any of the parameters are of incorrect type.
     */
    listMultiPartUploads(delimiter?: string, prefix?: string, method?: HttpMethod, opts?: Object): Promise<any>;
    /**
     * Get an object from the bucket.
     * @param {string} key - The key of the object to get.
     * @param {Object} [opts={}] - Additional options for the get operation.
     * @returns {Promise<string>} The content of the object.
     */
    get(key: string, opts?: Record<string, any>): Promise<string>;
    /**
     *
     * @param {string} key - The key of the object to get.
     * @param {Object} [opts={}] - Additional options for the get operation.
     * @returns {Promise<{ etag: string; data: string }>} The content of the object.
     */
    getObjectWithETag(key: string, opts?: Record<string, any>): Promise<{
        etag: string;
        data: string;
    }>;
    /**
     * Get the ETag of an object.
     * @param {string} key - The key of the object to get.
     * @param {Object} [opts={}] - Additional options for the get operation.
     * @returns {Promise<string|null>} The ETag of the object or null if the object etag does not match.
     */
    getEtag(key: string, opts?: Record<string, any>): Promise<string | null>;
    /**
     * Get a response of an object from the bucket.
     * @param {string} key - The key of the object to get.
     * @param {boolean} [wholeFile=true] - Whether to get the whole file or a part.
     * @param {number} [rangeFrom=0] - The range from to get if not getting the whole file.
     * @param {number} [rangeTo=this.maxRequestSizeInBytes] - The range to to get if not getting the whole file. Note: rangeTo is inclusive.
     * @param {Object} [opts={}] - Additional options for the get operation.
     * @returns {Promise<Response>} Response of the object content. Use readableStream() to get the stream from .body.
     */
    getResponse(key: string, wholeFile?: boolean, rangeFrom?: number, rangeTo?: number, opts?: Record<string, any>): Promise<Response>;
    /**
     * Put an object into the bucket.
     * @param {string} key - The key of the object to put. To create a folder, include a trailing slash.
     * @param {Buffer|string} data - The content of the object to put.
     * @returns {Promise<Object>} The response from the put operation.
     * @throws {TypeError} If the key is not a non-empty string or data is not a Buffer or string.
     */
    put(key: string, data: string | Buffer): Promise<Object>;
    /**
     * Initiate a multipart upload.
     * @param {string} key - The key of the object to upload.
     * @param {string} [fileType='application/octet-stream'] - The MIME type of the file.
     * @returns {Promise<string>} The upload ID for the multipart upload.
     * @throws {TypeError} If the key is not a non-empty string or fileType is not a string.
     * @throws {Error} If the multipart upload initiation fails.
     */
    getMultipartUploadId(key: string, fileType?: string): Promise<string>;
    /**
     * Upload a part in a multipart upload.
     * @param {string} key - The key of the object being uploaded.
     * @param {Buffer|string} data - The content of the part.
     * @param {string} uploadId - The upload ID of the multipart upload.
     * @param {number} partNumber - The part number.
     * @param {Object} [opts={}] - Additional options for the upload.
     * @returns {Promise<Object>} The ETag and part number of the uploaded part.
     * @throws {TypeError} If any of the parameters are of incorrect type.
     */
    uploadPart(key: string, data: Buffer | string, uploadId: string, partNumber: number, opts?: Object): Promise<UploadPart>;
    private _validateUploadPartParams;
    /**
     * Complete a multipart upload.
     * @param {string} key - The key of the object being uploaded.
     * @param {string} uploadId - The upload ID of the multipart upload.
     * @param {Array<Object>} parts - An array of objects containing PartNumber and ETag for each part.
     * @returns {Promise<Object>} The result of the complete multipart upload operation.
     * @throws {TypeError} If any of the parameters are of incorrect type.
     * @throws {Error} If the complete multipart upload operation fails.
     */
    completeMultipartUpload(key: string, uploadId: string, parts: Array<UploadPart>): Promise<CompleteMultipartUploadResult>;
    /**
     * Aborts a multipart upload.
     * @param {string} key - The key of the object being uploaded.
     * @param {string} uploadId - The ID of the multipart upload to abort.
     * @returns {Promise<Object>} - A promise that resolves to the abort response.
     * @throws {Error} If the abort operation fails.
     */
    abortMultipartUpload(key: string, uploadId: string): Promise<object>;
    private _buildCompleteMultipartUploadXml;
    /**
     * Delete an object from the bucket.
     * @param {string} key - The key of the object to delete.
     * @returns {Promise<boolean>} The response from the delete operation. True if the delete operation was successful, false otherwise. Note: The delete operation may return a 204 status code even if the object was not found.
     */
    delete(key: string): Promise<boolean>;
    _sendRequest(url: string, method: HttpMethod, headers: Record<string, string | any>, body?: string | Buffer): Promise<Response>;
    _handleErrorResponse(res: Response): Promise<void>;
    _buildCanonicalQueryString(queryParams: Object): string;
    _getSignatureKey(dateStamp: string): Promise<string>;
}
export { S3 };
export default S3;
