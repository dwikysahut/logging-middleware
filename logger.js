const fs = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "logs/api.log");
const OMITTED_IMAGE = "[omitted-image-content]";
const OMITTED_BASE64 = "[omitted-base64-content]";
const TRUNCATED = "[truncated]";
const MAX_LOG_STRING_LENGTH = 4000;
const IMAGE_KEY_PATTERN = /(image|img|photo|picture|avatar|file|blob|base64|fingerprint)/i;

function writeLog(entry) {
  fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
}

function isLikelyBase64String(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (value.startsWith("data:image/") || value.startsWith("data:application/octet-stream;base64,")) {
    return true;
  }

  if (value.length < 256 || value.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function sanitizeValue(value, parentKey = "") {
  if (value === undefined || value === null) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return OMITTED_IMAGE;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, parentKey));
  }

  if (typeof value === "object") {
    const sanitizedObject = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (IMAGE_KEY_PATTERN.test(key)) {
        sanitizedObject[key] = OMITTED_IMAGE;
        continue;
      }

      sanitizedObject[key] = sanitizeValue(nestedValue, key);
    }

    return sanitizedObject;
  }

  if (typeof value === "string") {
    if (IMAGE_KEY_PATTERN.test(parentKey)) {
      return OMITTED_IMAGE;
    }

    if (isLikelyBase64String(value)) {
      return OMITTED_BASE64;
    }

    if (value.length > MAX_LOG_STRING_LENGTH) {
      return `${value.slice(0, MAX_LOG_STRING_LENGTH)}...${TRUNCATED}`;
    }
  }

  return value;
}

function normalizeBody(body) {
  return sanitizeValue(body);
}

function logProxyResponse({
  req,
  status,
  duration,
  upstream,
  requestHeaders,
  requestBody,
  responseHeaders,
  responseBody,
}) {
  const log = {
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    requestHeaders,
    requestBody: normalizeBody(requestBody),
    status,
    duration,
    ip: req.ip,
    upstream,
    responseHeaders,
    responseBody: normalizeBody(responseBody),
  };

  writeLog(log);
}

function logProxyError({ req, error, duration, upstream, requestHeaders, requestBody }) {
  const log = {
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    requestHeaders,
    requestBody: normalizeBody(requestBody),
    status: 502,
    duration,
    ip: req.ip,
    upstream,
    error,
  };

  writeLog(log);
}

function logIngest({ req, payload, phase }) {
  const log = {
    time: new Date().toISOString(),
    phase,
    ip: req.ip,
    payload: normalizeBody(payload),
  };

  writeLog(log);
}

module.exports = {
  logProxyResponse,
  logProxyError,
  logIngest,
};
