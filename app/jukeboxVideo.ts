export function getJukeboxVideoId(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (url.protocol !== "https:") return null;

    const id =
      host === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "music.youtube.com"
          ? url.pathname === "/watch"
            ? url.searchParams.get("v")
            : /^(\/shorts\/|\/live\/|\/embed\/)/.test(url.pathname)
              ? url.pathname.split("/")[2]
              : null
          : null;

    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

