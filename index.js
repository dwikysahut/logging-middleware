const express = require("express");
const { createProxyMiddleware, responseInterceptor, fixRequestBody } = require("http-proxy-middleware");
const { logIngest, logProxyResponse, logProxyError } = require("./logger");

const app = express();
const PORT = process.env.PORT || 4000;
const ENABLE_LEGACY_LOG_ROUTES = process.env.ENABLE_LEGACY_LOG_ROUTES === "true";
const ENABLE_UPSTREAM_PROXY = process.env.ENABLE_UPSTREAM_PROXY === "true";
const UPSTREAM_URL = process.env.UPSTREAM_URL || "http://localhost:5050";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function handleLog(req, res) {
  logIngest({
    req,
    payload: req.body,
    phase: req.body?.phase || "unknown",
  });

  res.status(202).json({ message: "logged" });
}

app.post("/log", handleLog);
app.post("/api/log", handleLog);

if (ENABLE_UPSTREAM_PROXY) {
  app.use((req, res, next) => {
    req._startTime = Date.now();
    next();
  });

  app.use(
    "/api",
    createProxyMiddleware({
      target: UPSTREAM_URL,
      changeOrigin: true,
      logLevel: "warn",
      selfHandleResponse: true,
      on: {
        proxyReq(proxyReq, req) {
          fixRequestBody(proxyReq, req);
        },
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req) => {
          logProxyResponse({
            req,
            status: proxyRes.statusCode,
            duration: Date.now() - req._startTime,
            upstream: UPSTREAM_URL,
            requestHeaders: req.headers,
            requestBody: req.body,
            responseHeaders: proxyRes.headers,
            responseBody: responseBuffer,
          });

          return responseBuffer;
        }),
        error(err, req, res) {
          logProxyError({
            req,
            error: err.message,
            duration: Date.now() - req._startTime,
            upstream: UPSTREAM_URL,
            requestHeaders: req.headers,
            requestBody: req.body,
          });

          res.status(502).json({
            message: "Bad Gateway",
            error: err.message,
          });
        },
      },
    }),
  );
}

if (ENABLE_LEGACY_LOG_ROUTES) {
  app.post("/log/ingest", (req, res) => {
    logIngest({
      req,
      payload: req.body,
      phase: req.body?.phase || "unknown",
    });

    res.status(202).json({ message: "logged" });
  });

  app.post("/log/request", (req, res) => {
    logIngest({
      req,
      payload: req.body,
      phase: "request",
    });

    res.status(202).json({ message: "logged" });
  });

  app.post("/log/response", (req, res) => {
    logIngest({
      req,
      payload: req.body,
      phase: "response",
    });

    res.status(202).json({ message: "logged" });
  });
}

app.listen(PORT, () => {
  console.log(`Logging service running on port ${PORT}`);
  if (ENABLE_UPSTREAM_PROXY) {
    console.log(`Proxy mode enabled for /api to ${UPSTREAM_URL}`);
  }
});
