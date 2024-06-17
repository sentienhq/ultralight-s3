// src/index.js
import { createHmac, createHash } from "node:crypto";
var expectArray = {
  contents: true
};
var S3 = class {
  constructor({ accessKeyId, secretAccessKey, endpoint, bucketName = "", region = "auto" }) {
    if (typeof accessKeyId !== "string" || accessKeyId.length === 0)
      throw new TypeError("accessKeyId must be a non-empty string");
    if (typeof secretAccessKey !== "string" || secretAccessKey.length === 0)
      throw new TypeError("secretAccessKey must be a non-empty string");
    if (typeof endpoint !== "string" || endpoint.length === 0)
      throw new TypeError("endpoint must be a non-empty string");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.endpoint = endpoint;
    this.bucketName = bucketName;
    this.region = region;
  }
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
      bucket: this.bucket
    };
  };
  async sign(method, path, query, headers, body) {
    const datetime = (/* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
    const url = new URL(path, this.endpoint);
    const encodedBucketName = encodeURIComponent(this.bucketName);
    url.pathname = `/${encodedBucketName}${url.pathname}`;
    const canonicalHeaders = Object.entries(headers).map(([key, value]) => `${key.toLowerCase()}:${String(value).trim()}`).sort().join("\n");
    const signedHeaders = Object.keys(headers).map((key) => key.toLowerCase()).sort().join(";");
    const canonicalRequest = [
      method,
      encodeURI(url.pathname),
      buildCanonicalQueryString(query),
      canonicalHeaders + "\n",
      signedHeaders,
      body ? await hash(body) : "UNSIGNED-PAYLOAD"
    ].join("\n");
    const credentialScope = [datetime.slice(0, 8), this.region, "s3", "aws4_request"].join("/");
    const stringToSign = ["AWS4-HMAC-SHA256", datetime, credentialScope, await hash(canonicalRequest)].join("\n");
    const signingKey = await getSignatureKey(this.secretAccessKey, datetime.slice(0, 8), this.region, "s3");
    const signature = await hmac(signingKey, stringToSign, "hex");
    const authorizationHeader = [
      "AWS4-HMAC-SHA256 Credential=" + this.accessKeyId + "/" + credentialScope,
      "SignedHeaders=" + signedHeaders,
      "Signature=" + signature
    ].join(", ");
    headers["Authorization"] = authorizationHeader;
    headers["x-amz-content-sha256"] = body ? await hash(body) : "UNSIGNED-PAYLOAD";
    headers["x-amz-date"] = datetime;
    headers["host"] = url.host;
    return {
      url: url.toString(),
      headers
    };
  }
  async list(path = "/", prefix = "", maxKeys = 1e3, method = "GET") {
    const query = {
      "list-type": "2",
      "max-keys": String(maxKeys)
    };
    const headers = {
      "Content-Type": "application/json",
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD"
    };
    const { url, headers: signedHeaders } = await this.sign("GET", path, query, headers, "");
    const searchParams = new URLSearchParams(query);
    const urlWithQuery = `${url}?${searchParams.toString()}`;
    const res = await fetch(urlWithQuery, { headers: signedHeaders });
    if (!res.ok) {
      const errorBody = await res.text();
      console.log("Error Body:", errorBody);
      const errorCode = res.headers.get("x-amz-error-code") || "Unknown";
      const errorMessage2 = res.headers.get("x-amz-error-message") || res.statusText;
      throw new Error(`ListV2 failed with status ${res.status}: ${errorCode} - ${errorMessage2}`);
    }
    let data = [];
    let responseBody = await res.text();
    if (res.statusCode > 299) {
      data = method !== "HEAD" && parseXml(responseBody).error || (path ? "The specified key does not exist." : "The specified bucket is not valid.");
      throw new Error("yadada: " + errorMessage);
    }
    data = method === "GET" ? parseXml(responseBody) : {
      size: +res.headers["content-length"],
      mtime: new Date(res.headers["last-modified"]),
      etag: res.headers.etag
    };
    const output = data.listBucketResult || data.error || data;
    return output.contents || output;
  }
  async get(key, opts) {
    const query = opts || {};
    const headers = {
      "Content-Type": "application/json",
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD"
    };
    const { url, headers: signedHeaders } = await this.sign("GET", key, query, headers, "");
    const res = await fetch(url, { headers: signedHeaders });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error Body:", errorBody);
      const errorCode = res.headers.get("x-amz-error-code") || "Unknown";
      const errorMessage2 = res.headers.get("x-amz-error-message") || res.statusText;
      throw new Error(`GET failed with status ${res.status}: ${errorCode} - ${errorMessage2}`);
    }
    return res.text();
  }
  async put(key, data, opts) {
    const query = opts || {};
    const headers = {
      "Content-Length": data.length
    };
    const { url, headers: signedHeaders } = await this.sign("PUT", key, query, headers, data);
    const res = await fetch(url, { method: "PUT", headers: signedHeaders, body: data });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error Body:", errorBody);
      const errorCode = res.headers.get("x-amz-error-code") || "Unknown";
      const errorMessage2 = res.headers.get("x-amz-error-message") || res.statusText;
      throw new Error(`PUT failed with status ${res.status}: ${errorCode} - ${errorMessage2}`);
    }
    return res;
  }
  async delete(path, opts) {
    const query = opts || {};
    const headers = {};
    const { url, headers: signedHeaders } = await this.sign("DELETE", path, query, headers, "");
    const res = await fetch(url, { method: "DELETE", headers: signedHeaders });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error Body:", errorBody);
      const errorCode = res.headers.get("x-amz-error-code") || "Unknown";
      const errorMessage2 = res.headers.get("x-amz-error-message") || res.statusText;
      throw new Error(`DELETE failed with status ${res.status}: ${errorCode} - ${errorMessage2}`);
    }
    return res.json();
  }
};
var buildCanonicalQueryString = (queryParams) => {
  if (Object.keys(queryParams).length < 1) {
    return "";
  }
  const sortedQueryParams = Object.keys(queryParams).sort();
  let canonicalQueryString = "";
  for (let i = 0; i < sortedQueryParams.length; i++) {
    canonicalQueryString += encodeURIComponent(sortedQueryParams[i]) + "=" + encodeURIComponent(queryParams[sortedQueryParams[i]]) + "&";
  }
  return canonicalQueryString.slice(0, -1);
};
var getSignatureKey = async (secretAccessKey, dateStamp, region, serviceName) => {
  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, serviceName);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
};
var hash = async (content) => {
  const hashSum = createHash("sha256");
  hashSum.update(content);
  return hashSum.digest("hex");
};
var hmac = async (key, content, encoding) => {
  const hmacSum = createHmac("sha256", key);
  hmacSum.update(content);
  return hmacSum.digest(encoding);
};
var parseXml = (str) => {
  const unescapeXml = (value) => {
    return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  };
  let key, val;
  const json = {};
  const re = /<(\w)([-\w]+)(?:\/|[^>]*>((?:(?!<\1)[\s\S])*)<\/\1\2)>/gm;
  for (; val = re.exec(str); ) {
    key = val[1].toLowerCase() + val[2];
    val = val[3] != null ? parseXml(val[3]) : true;
    if (typeof val === "string") {
      val = unescapeXml(val);
    }
    if (Array.isArray(json[key])) json[key].push(val);
    else json[key] = json[key] != null ? [json[key], val] : expectArray[key] ? [val] : val;
  }
  return key ? json : str;
};
var src_default = S3;
export {
  S3,
  src_default as default
};
