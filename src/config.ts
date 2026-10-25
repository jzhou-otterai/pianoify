/**
 * What the client needs to know about the outside world.
 *
 * Mirelo is not one of these. It is reached through this site's own `/api/*`
 * functions, because the API key bills a real account and anything `VITE_*` is
 * inlined into a bundle a browser can read. The other three backends — chords,
 * yt-dlp, and the GPU box — are public or same-origin, and are named here.
 */

function base(raw: string | undefined, fallback: string): string {
  return (raw ?? fallback).trim().replace(/\/+$/, "");
}

/** The standalone chord service: CPU-only BTC chord recognition on a free
 *  Hugging Face Space. An explicitly empty value makes every chord URL a
 *  relative path, which is what the dev proxy in `vite.config.ts` forwards. */
export const CHORD_BASE = base(
  import.meta.env.VITE_CHORD_API_BASE,
  "https://jerrdeh-muscriptor-chords.hf.space",
);

/** Whether to ask for chords at all. Off with the literal `off`, because empty
 *  already means something else here (same-origin, via the dev proxy). */
export const chordServiceEnabled =
  (import.meta.env.VITE_CHORD_API_BASE ?? "").trim().toLowerCase() !== "off";

export const chordApi = (path: string) => CHORD_BASE + path;

/**
 * The longest clip this app transcribes, in seconds.
 *
 * The real cap lives in `api/_mirelo.ts`, which measures the WAV it is handed
 * and refuses anything longer — the browser cannot be trusted with a limit
 * that costs money. This copy is what stops the trim handles from opening on a
 * crop that would only be rejected, and it must match the server's.
 */
export const MAX_CLIP_SECONDS = 10;

/** How long a crop the trim handles open on. The cap, since there is no room
 *  under it worth defaulting to. */
export const CLIP_SECONDS = MAX_CLIP_SECONDS;

/**
 * The YouTube→audio service: the Local YouTube Downloader behind
 * downloads.jerryzhou.ca, which wants a bearer token the browser must not see.
 *
 * Empty by default, so `/ytdlp/download` is relative: `vercel.json` rewrites
 * it to the `api/ytdlp.ts` function in production and the dev server mounts
 * the same function locally. The function holds `YTDLP_TOKEN` and forwards.
 */
export const YTDLP_BASE = base(import.meta.env.VITE_YTDLP_API_BASE, "");

export const ytdlpApi = (path: string) => YTDLP_BASE + path;

/**
 * The CPU server that runs MuScriptor Small, the other transcriber in the picker.
 *
 * The default is a path on this origin, not the box's own hostname: the box
 * answers a browser only from origins in its `MUSCRIPTOR_ALLOWED_ORIGINS`, and
 * a Vercel preview URL is never one of them. `/gpu/*` is rewritten to the box
 * by `vercel.json` in production and proxied by the dev server locally, which
 * makes every call same-origin to the browser and server-to-server to the box,
 * where CORS does not apply.
 *
 * Point this at `https://jerryzhou.ca/muscriptor` to talk to the box
 * directly — which works only from an origin it lists. Blank means the default
 * rather than same-origin-with-no-prefix, which the chord base above uses it
 * for: there the prefix *is* the path the proxy matches, so an empty base
 * would only produce a URL nothing serves.
 */
export const MUSCRIPTOR_BASE = base(
  import.meta.env.VITE_MUSCRIPTOR_API_BASE?.trim() || undefined,
  "/gpu",
);

export const muscriptorApi = (path: string) => MUSCRIPTOR_BASE + path;

/** Pixels per second of music on the roll. At 130 a bar of anything moderate
 *  is about a thumb's width, which is the zoom the roll was designed at. */
export const PIXELS_PER_SECOND = 130;
