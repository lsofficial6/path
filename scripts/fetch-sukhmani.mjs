import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOTAL_PAGES = 82;
const API_BASE = "https://backend.searchgurbani.com/api/baanis/sukhmani-sahib?page=";
const AUDIO_ENDPOINT = "https://backend.searchgurbani.com/api/audio/download?path=baanis/sukhmani_sahib";
const REQUEST_GAP_MS = 1200;
const RETRY_LIMIT = 4;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, "..", "data", "sukhmani-data.js");

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.ok) {
    return response.json();
  }

  if (attempt >= RETRY_LIMIT) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  const retryDelay = response.status === 429 ? 5000 : attempt * 1500;
  console.warn(`Retrying ${url} after ${retryDelay}ms (status ${response.status})`);
  await wait(retryDelay);
  return fetchJson(url, attempt + 1);
}

async function fetchPages() {
  const pages = [];

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const data = await fetchJson(`${API_BASE}${page}`);
    const lines = Array.isArray(data.lines) ? data.lines : [];

    pages.push({
      index: page,
      ang: lines[0]?.pageno ?? null,
      lines: lines.map((line) => ({
        punjabi: line.punjabi,
        lareedar: line.lareedar,
        translit: line.translit,
        english: line.english,
      })),
    });

    console.log(`Fetched page ${page}/${TOTAL_PAGES}`);

    if (page < TOTAL_PAGES) {
      await wait(REQUEST_GAP_MS);
    }
  }

  return pages;
}

async function main() {
  const [pages, audio] = await Promise.all([
    fetchPages(),
    fetchJson(AUDIO_ENDPOINT),
  ]);

  const totalLines = pages.reduce((count, page) => count + page.lines.length, 0);
  const audioUrl = audio?.data
    ? `https://backend.searchgurbani.com/${String(audio.data).replace(/^\/+/, "")}`
    : "";

  const payload = {
    metadata: {
      title: "Sukhmani Sahib",
      totalPages: pages.length,
      totalLines,
      source: "SearchGurbani",
      audioUrl,
      generatedAt: new Date().toISOString(),
    },
    pages,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `window.SUKHMANI_PAYLOAD = ${JSON.stringify(payload)};\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(`Pages: ${payload.metadata.totalPages}, lines: ${payload.metadata.totalLines}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});