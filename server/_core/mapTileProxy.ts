import type { Express } from "express";

const OPENFREEMAP_ORIGIN = "https://tiles.openfreemap.org";
const ALLOWED_RESOURCE_ROOTS = new Set(["styles", "planet", "natural_earth", "fonts", "sprites"]);
const ALLOWED_PATH_SEGMENT = /^[A-Za-z0-9., _@+-]+$/;

export function resolveOpenFreeMapResource(rawPath: string): URL | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath).replace(/^\/+/, "");
  } catch {
    return null;
  }

  if (!decodedPath || decodedPath.length > 512 || /[\\\u0000-\u001f\u007f?#]/.test(decodedPath)) return null;
  const segments = decodedPath.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || !ALLOWED_PATH_SEGMENT.test(segment))) return null;
  if (!ALLOWED_RESOURCE_ROOTS.has(segments[0])) return null;
  if (segments.length < 2 && segments[0] !== "planet") return null;

  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join("/");
  return new URL(encodedPath, `${OPENFREEMAP_ORIGIN}/`);
}

export function registerMapTileProxy(app: Express) {
  app.get("/api/map-tiles/*", async (req, res) => {
    const resourcePath = (req.params as Record<string, string>)[0] ?? "";
    const upstreamUrl = resolveOpenFreeMapResource(resourcePath);
    if (!upstreamUrl) {
      res.status(404).send("Unknown map resource");
      return;
    }

    try {
      const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(12_000) });
      if (!upstream.ok) {
        res.status(upstream.status === 404 ? 404 : 502).send("Map resource unavailable");
        return;
      }

      const body = Buffer.from(await upstream.arrayBuffer());
      res.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
      res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.status(200).send(body);
    } catch {
      res.status(502).send("Map resource unavailable");
    }
  });
}
