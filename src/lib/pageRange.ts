export type PageRangeResult =
  | { ok: true; pages: number[] }
  | { ok: false; error: string };

/**
 * Parse `1-3, 5, 8-10` into 1-based page numbers.
 * Whitespace is ignored, duplicates removed, results sorted.
 * Rejects reversed ranges such as `5-2` and values beyond `pageCount`.
 */
export function parsePageRange(input: string, pageCount: number): PageRangeResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a page range such as 1-3, 5, 8-10." };
  }
  if (pageCount < 1) {
    return { ok: false, error: "This PDF has no pages." };
  }

  const unique = new Set<number>();
  const tokens = trimmed.split(",");

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) {
      return {
        ok: false,
        error: "There's an empty item in the range (extra comma).",
      };
    }

    const dash = token.indexOf("-");
    if (dash === -1) {
      const page = parseStrictInt(token);
      if (page === null) {
        return { ok: false, error: "\"" + token + "\" is not a valid page number." };
      }
      if (page < 1) {
        return { ok: false, error: "Page " + String(page) + " is below 1." };
      }
      if (page > pageCount) {
        return {
          ok: false,
          error:
            "Page " +
            String(page) +
            " is beyond this PDF's " +
            String(pageCount) +
            " pages.",
        };
      }
      unique.add(page);
      continue;
    }

    const startToken = token.slice(0, dash).trim();
    const endToken = token.slice(dash + 1).trim();
    if (endToken.includes("-")) {
      return { ok: false, error: "\"" + token + "\" is not a valid range." };
    }
    const start = parseStrictInt(startToken);
    const end = parseStrictInt(endToken);
    if (start === null || end === null) {
      return { ok: false, error: "\"" + token + "\" is not a valid range." };
    }
    if (start > end) {
      return {
        ok: false,
        error:
          "Reversed range \"" +
          token +
          "\" is not allowed (start is after end).",
      };
    }
    if (start < 1) {
      return { ok: false, error: "Page " + String(start) + " is below 1." };
    }
    if (end > pageCount) {
      return {
        ok: false,
        error:
          "Page " +
          String(end) +
          " is beyond this PDF's " +
          String(pageCount) +
          " pages.",
      };
    }
    for (let p = start; p <= end; p += 1) unique.add(p);
  }

  const pages = Array.from(unique).sort((a, b) => a - b);
  if (pages.length === 0) {
    return { ok: false, error: "Enter at least one page." };
  }
  return { ok: true, pages };
}

function parseStrictInt(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}
