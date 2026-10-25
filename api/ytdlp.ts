/**
 * GET /ytdlp/download?url=… — a YouTube video's audio, through this origin.
 *
 * The downloader is the Local YouTube Downloader on the Mac, exposed by the
 * `slowedrvb-mac` Cloudflare tunnel at downloads.jerryzhou.ca. From outside it
 * answers only a request carrying `Authorization: Bearer <token>` and
 * `X-Local-Download: 1`, and a `vercel.json` rewrite can change where a
 * request goes but cannot add headers to it. So `/ytdlp/download` is
 * rewritten to this function instead, which holds the token and forwards.
 *
 * The client still calls `/ytdlp/download` and reads the downloader's own
 * `{"detail": …}` on a failure, so upstream errors are passed through as they
 * came rather than rewrapped in this API's `{"error": …}`.
 */
import { json, query, route, throttle } from "./_mirelo.js";

const UPSTREAM = process.env.YTDLP_ORIGIN?.trim() || "https://downloads.jerryzhou.ca";

/** A download runs at roughly half the video's own length. */
export const config = { maxDuration: 300 };

export default route({
  GET: async (req, res) => {
    // The downloader runs two jobs at once and shares them with slowedrvb, so
    // a loop here would lock out both sites.
    throttle(req, "ytdlp", 6, 60_000);
    const token = process.env.YTDLP_TOKEN?.trim();
    if (!token) {
      json(res, 500, {
        detail: "YTDLP_TOKEN is not set on the server — add it to the project's environment variables",
      });
      return;
    }
    const url = query(req).get("url") ?? "";

    // A closed tab should free the downloader's slot, not leave it finishing a
    // file nobody will read.
    const abort = new AbortController();
    res.on("close", () => abort.abort());

    let upstream: Response;
    try {
      upstream = await fetch(`${UPSTREAM}/download?url=${encodeURIComponent(url)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Local-Download": "1",
          "X-Download-Source": "pianoify",
        },
        signal: abort.signal,
      });
    } catch {
      if (abort.signal.aborted) return;
      json(res, 502, { detail: "the download service could not be reached" });
      return;
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(text);
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "audio/mp4");
    res.setHeader("Cache-Control", "no-store");
    for (const name of ["content-length", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {
      // The client went away, or the downloader dropped mid-file. Either way
      // the response is committed; ending it short is all that is left.
    }
    res.end();
  },
});
