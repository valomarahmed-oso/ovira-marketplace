// Metro config with one addition: a development-only API proxy.
//
// The app itself never needs this. React Native's fetch is a native HTTP client
// with no notion of an origin, so on a phone it calls demo.ovira.cloud directly
// and CORS does not exist. But `expo start --web` runs the same bundle inside a
// browser at localhost:8081, and there a cross-origin call to the Frappe site is
// refused before it is even sent — which would make the web target useless for
// checking screens as they are built.
//
// Rather than open CORS on a production site to suit a development tool, the dev
// server forwards `/api/*` itself. Only `npm run web` is affected; iOS, Android
// and every production build ignore this file's proxy entirely.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const { URL } = require("node:url");

const config = getDefaultConfig(__dirname);

/**
 * `@ovira/core` is a `file:` dependency, so npm links it rather than copying it.
 * Metro does not follow that link out of `node_modules` on its own: it kept
 * serving whichever build of the package it saw first, so rebuilding core
 * changed nothing on screen and the app called functions that "did not exist".
 *
 * Naming the real directory as a watch folder makes an edit there behave like an
 * edit anywhere else in this app.
 */
const CORE = path.resolve(__dirname, "..", "packages", "core");
config.watchFolders = [...(config.watchFolders ?? []), CORE];
config.resolver = {
  ...config.resolver,
  // Both roots, in this order: the app's own copy of react/react-native must
  // win, or a second React instance loads and every hook throws.
  nodeModulesPaths: [
    path.resolve(__dirname, "node_modules"),
    path.resolve(CORE, "node_modules"),
  ],
};

const TARGET = new URL(process.env.EXPO_PUBLIC_FRAPPE_URL || "https://demo.ovira.cloud");
const client = TARGET.protocol === "https:" ? require("node:https") : require("node:http");

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url || !req.url.startsWith("/api/")) return middleware(req, res, next);

    const upstream = client.request(
      {
        protocol: TARGET.protocol,
        hostname: TARGET.hostname,
        port: TARGET.port || undefined,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          // Frappe routes by Host; leaving localhost here lands on the wrong
          // site (or none) and the error looks like a 404 from the app.
          host: TARGET.host,
          origin: TARGET.origin,
        },
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      },
    );

    upstream.on("error", (err) => {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ exception: `dev proxy: ${err.message}` }));
    });

    req.pipe(upstream);
  },
};

module.exports = config;
