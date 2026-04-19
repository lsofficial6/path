const payload = window.SUKHMANI_PAYLOAD;

const STORAGE_KEY = "sukhmani-sahib-reader-settings";

const state = {
  search: "",
  larivaar: true,
  fontSize: 32,
  lineHeight: 2.05,
  measure: 68,
  currentPage: 1,
  fullscreen: false,
  settingsOpen: false,
  toolbarVisible: true,
  toolbarScrollAnchor: 0,
};

const dom = {
  reader: document.getElementById("reader"),
  readerStatus: document.getElementById("readerStatus"),
  searchInput: document.getElementById("searchInput"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  topButton: document.getElementById("topButton"),
  pageJump: document.getElementById("pageJump"),
  modeToggle: document.getElementById("modeToggle"),
  assistToggle: document.getElementById("assistToggle"),
  settingsToggle: document.getElementById("settingsToggle"),
  fullscreenToggle: document.getElementById("fullscreenToggle"),
  fontSizeInput: document.getElementById("fontSizeInput"),
  fontSizeValue: document.getElementById("fontSizeValue"),
  lineHeightInput: document.getElementById("lineHeightInput"),
  lineHeightValue: document.getElementById("lineHeightValue"),
  measureInput: document.getElementById("measureInput"),
  measureValue: document.getElementById("measureValue"),
  searchSummary: document.getElementById("searchSummary"),
  dataSummary: document.getElementById("dataSummary"),
  audioPlayer: document.getElementById("audioPlayer"),
  backToTopButton: document.getElementById("backToTopButton"),
  scrollProgressBar: document.getElementById("scrollProgressBar"),
  statPages: document.getElementById("statPages"),
  statLines: document.getElementById("statLines"),
  currentPagePill: document.getElementById("currentPagePill"),
  viewModeLabel: document.getElementById("viewModeLabel"),
  readerPanel: document.querySelector(".reader-panel"),
  fullscreenSettings: document.getElementById("fullscreenSettings"),
  fullscreenSearchInput: document.getElementById("fullscreenSearchInput"),
  fullscreenClearSearchButton: document.getElementById("fullscreenClearSearchButton"),
  fullscreenTopButton: document.getElementById("fullscreenTopButton"),
  fullscreenPageJump: document.getElementById("fullscreenPageJump"),
  fullscreenModeToggle: document.getElementById("fullscreenModeToggle"),
  fullscreenAssistToggle: document.getElementById("fullscreenAssistToggle"),
  fullscreenFontSizeInput: document.getElementById("fullscreenFontSizeInput"),
  fullscreenFontSizeValue: document.getElementById("fullscreenFontSizeValue"),
  fullscreenLineHeightInput: document.getElementById("fullscreenLineHeightInput"),
  fullscreenLineHeightValue: document.getElementById("fullscreenLineHeightValue"),
  fullscreenMeasureInput: document.getElementById("fullscreenMeasureInput"),
  fullscreenMeasureValue: document.getElementById("fullscreenMeasureValue"),
  fullscreenAudioPlayer: document.getElementById("fullscreenAudioPlayer"),
};

let pageObserver;
let lineFitFrame = 0;
let fullscreenScrollFrame = 0;
let fullscreenTapStart = null;

const MIN_FITTED_FONT_SIZE = 16;
const FULLSCREEN_TOOLBAR_HIDE_DISTANCE = 24;
const FULLSCREEN_TOOLBAR_SHOW_DISTANCE = 16;
const FULLSCREEN_TOOLBAR_TOP_ZONE = 32;
const FULLSCREEN_TAP_MAX_DISTANCE = 12;
const FULLSCREEN_TAP_MAX_DURATION = 280;

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, query) {
  const safeText = escapeHtml(text);

  if (!query) {
    return safeText;
  }

  const matcher = new RegExp(`(${escapeRegex(query)})`, "gi");
  return safeText.replace(matcher, "<mark>$1</mark>");
}

function isHeadingLine(text) {
  return /^(ਸਲੋਕੁ|ਅਸਟਪਦੀ|ਰਹਾਉ)/.test(text.trim());
}

function readSettings() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.larivaar = parsed.larivaar ?? state.larivaar;
    state.fontSize = parsed.fontSize ?? state.fontSize;
    state.lineHeight = parsed.lineHeight ?? state.lineHeight;
    state.measure = parsed.measure ?? state.measure;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function writeSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      larivaar: state.larivaar,
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      measure: state.measure,
    }),
  );
}

function applyReaderPreferences() {
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
  document.documentElement.style.setProperty("--reader-line-height", `${state.lineHeight}`);
  document.documentElement.style.setProperty("--reader-measure", `${state.measure}ch`);

  dom.fontSizeInput.value = String(state.fontSize);
  dom.fullscreenFontSizeInput.value = String(state.fontSize);
  dom.fontSizeValue.textContent = `${state.fontSize}px`;
  dom.fullscreenFontSizeValue.textContent = `${state.fontSize}px`;
  dom.lineHeightInput.value = String(state.lineHeight);
  dom.fullscreenLineHeightInput.value = String(state.lineHeight);
  dom.lineHeightValue.textContent = state.lineHeight.toFixed(2);
  dom.fullscreenLineHeightValue.textContent = state.lineHeight.toFixed(2);
  dom.measureInput.value = String(state.measure);
  dom.fullscreenMeasureInput.value = String(state.measure);
  dom.measureValue.textContent = `${state.measure}ch`;
  dom.fullscreenMeasureValue.textContent = `${state.measure}ch`;

  dom.modeToggle.classList.toggle("is-active", state.larivaar);
  dom.modeToggle.setAttribute("aria-pressed", String(state.larivaar));
  dom.fullscreenModeToggle.classList.toggle("is-active", state.larivaar);
  dom.fullscreenModeToggle.setAttribute("aria-pressed", String(state.larivaar));
  dom.assistToggle.classList.toggle("is-active", !state.larivaar);
  dom.assistToggle.setAttribute("aria-pressed", String(!state.larivaar));
  dom.fullscreenAssistToggle.classList.toggle("is-active", !state.larivaar);
  dom.fullscreenAssistToggle.setAttribute("aria-pressed", String(!state.larivaar));
  dom.viewModeLabel.textContent = state.larivaar ? "Larivaar view" : "Pad Ched view";

  scheduleLineFit();
}

function syncSettingsPanel() {
  const showDrawer = state.fullscreen && state.settingsOpen;
  dom.fullscreenSettings.hidden = !showDrawer;
  dom.fullscreenSettings.classList.toggle("is-open", showDrawer);
  dom.settingsToggle.hidden = !state.fullscreen;
  dom.settingsToggle.setAttribute("aria-pressed", String(showDrawer));
  dom.settingsToggle.setAttribute(
    "aria-label",
    showDrawer ? "Hide fullscreen settings" : "Open fullscreen settings",
  );
  dom.settingsToggle.setAttribute(
    "title",
    showDrawer ? "Hide fullscreen settings" : "Open fullscreen settings",
  );

  if (showDrawer) {
    setFullscreenToolbarVisible(true);
  }
}

function setFullscreenToolbarVisible(visible) {
  const nextVisible = !state.fullscreen || visible;

  state.toolbarVisible = nextVisible;
  dom.readerPanel.classList.toggle("is-toolbar-hidden", state.fullscreen && !nextVisible);
  state.toolbarScrollAnchor = state.fullscreen ? dom.reader.scrollTop : 0;
}

function closeFullscreenSettings() {
  if (!state.settingsOpen) {
    return;
  }

  state.settingsOpen = false;
  syncSettingsPanel();
}

function setSearchValue(value) {
  state.search = value;
  dom.searchInput.value = value;
  dom.fullscreenSearchInput.value = value;
  renderReader();
}

function setLarivaarMode(enabled) {
  state.larivaar = enabled;
  applyReaderPreferences();
  writeSettings();
  renderReader();
}

function setFontSize(value) {
  state.fontSize = Number(value);
  applyReaderPreferences();
  writeSettings();
}

function setLineHeight(value) {
  state.lineHeight = Number(value);
  applyReaderPreferences();
  writeSettings();
}

function setMeasure(value) {
  state.measure = Number(value);
  applyReaderPreferences();
  writeSettings();
}

function isReaderFullscreen() {
  return (document.fullscreenElement || document.webkitFullscreenElement) === dom.readerPanel;
}

async function enterReaderFullscreen() {
  if (dom.readerPanel.requestFullscreen) {
    await dom.readerPanel.requestFullscreen();
    return;
  }

  if (dom.readerPanel.webkitRequestFullscreen) {
    dom.readerPanel.webkitRequestFullscreen();
  }
}

async function exitReaderFullscreen() {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }

  if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

function syncFullscreenState() {
  state.fullscreen = isReaderFullscreen();
  if (!state.fullscreen) {
    state.settingsOpen = false;
  }
  if (fullscreenScrollFrame) {
    cancelAnimationFrame(fullscreenScrollFrame);
    fullscreenScrollFrame = 0;
  }
  state.toolbarScrollAnchor = state.fullscreen ? dom.reader.scrollTop : 0;
  document.documentElement.classList.toggle("is-reader-fullscreen", state.fullscreen);
  dom.fullscreenToggle.textContent = state.fullscreen ? "Exit Full Screen" : "Full Screen";
  dom.fullscreenToggle.setAttribute("aria-pressed", String(state.fullscreen));
  dom.fullscreenToggle.setAttribute(
    "aria-label",
    state.fullscreen ? "Exit Gurbani full screen" : "Show Gurbani in full screen",
  );
  setFullscreenToolbarVisible(true);
  syncSettingsPanel();
  setupPageObserver();
  updateScrollProgress();
  scheduleLineFit();
}

async function toggleReaderFullscreen() {
  try {
    if (isReaderFullscreen()) {
      await exitReaderFullscreen();
      return;
    }

    await enterReaderFullscreen();
  } catch {
    dom.readerStatus.textContent = "Full screen could not be started in this browser.";
  }
}

function buildPageOptions() {
  const options = payload.pages
    .map(
      (page) =>
        `<option value="${page.index}">Page ${page.index} · Ang ${page.ang}</option>`,
    )
    .join("");

  dom.pageJump.innerHTML = options;
  dom.fullscreenPageJump.innerHTML = options;
}

function getDisplayText(line) {
  return state.larivaar ? line.lareedar : line.punjabi;
}

function fitReaderLines() {
  lineFitFrame = 0;

  const lines = dom.reader.querySelectorAll(".reader-line");

  lines.forEach((line) => {
    line.style.fontSize = "";

    const availableWidth = line.clientWidth;

    if (!availableWidth || line.scrollWidth <= availableWidth + 1) {
      return;
    }

    const baseFontSize = Number.parseFloat(window.getComputedStyle(line).fontSize);

    if (!baseFontSize) {
      return;
    }

    let nextFontSize = Math.max(
      MIN_FITTED_FONT_SIZE,
      Math.floor((baseFontSize * availableWidth * 100) / line.scrollWidth) / 100,
    );

    line.style.fontSize = `${nextFontSize}px`;

    while (line.scrollWidth > availableWidth + 1 && nextFontSize > MIN_FITTED_FONT_SIZE) {
      nextFontSize = Math.max(MIN_FITTED_FONT_SIZE, nextFontSize - 0.5);
      line.style.fontSize = `${nextFontSize}px`;
    }
  });
}

function scheduleLineFit() {
  if (lineFitFrame) {
    cancelAnimationFrame(lineFitFrame);
  }

  lineFitFrame = requestAnimationFrame(() => {
    fitReaderLines();
  });
}

function lineMatches(line, query) {
  if (!query) {
    return false;
  }

  const normalized = query.toLowerCase();
  return [line.punjabi, line.lareedar, line.translit, line.english]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized));
}

function renderReader() {
  const query = state.search.trim();
  let totalMatches = 0;
  let matchingPages = 0;

  const markup = payload.pages
    .map((page) => {
      const pageMatchCount = page.lines.reduce(
        (count, line) => count + (lineMatches(line, query) ? 1 : 0),
        0,
      );

      if (pageMatchCount > 0) {
        matchingPages += 1;
        totalMatches += pageMatchCount;
      }

      const linesMarkup = page.lines
        .map((line) => {
          const text = getDisplayText(line);
          const highlightQuery = lineMatches(line, query) ? query : "";
          const classes = ["reader-line"];

          if (isHeadingLine(line.punjabi)) {
            classes.push("reader-line--heading");
          }

          if (/^ਗਉੜੀ ਸੁਖਮਨੀ/.test(line.punjabi.trim())) {
            classes.push("reader-line--muted");
          }

          return `<p class="${classes.join(" ")}">${highlightText(text, highlightQuery)}</p>`;
        })
        .join("");

      return `
        <section class="page-block" id="page-${page.index}" data-page="${page.index}">
          <div class="page-block__head">
            <h3 class="page-block__title">Page ${page.index}</h3>
            <p class="page-block__meta">Ang ${page.ang} · ${page.lines.length} lines</p>
          </div>
          <div class="page-block__lines">
            ${linesMarkup}
          </div>
        </section>
      `;
    })
    .join("");

  dom.reader.innerHTML = markup;
  dom.readerStatus.textContent = "";

  if (!query) {
    dom.searchSummary.textContent = "Showing the full bani. Search highlights matches without hiding context.";
  } else if (totalMatches === 0) {
    dom.searchSummary.textContent = `No matches found for “${query}”.`;
  } else {
    dom.searchSummary.textContent = `${totalMatches} matching lines across ${matchingPages} page${matchingPages === 1 ? "" : "s"}.`;
  }

  setupPageObserver();
  updateScrollProgress();
  scheduleLineFit();
}

function setupPageObserver() {
  if (pageObserver) {
    pageObserver.disconnect();
  }

  const blocks = [...document.querySelectorAll(".page-block")];

  pageObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      const nextPage = Number(visible.target.dataset.page);
      state.currentPage = nextPage;
      dom.pageJump.value = String(nextPage);
      dom.fullscreenPageJump.value = String(nextPage);
      dom.currentPagePill.textContent = `Page ${nextPage}`;

      blocks.forEach((block) => {
        block.classList.toggle("is-current", block === visible.target);
      });
    },
    {
      root: state.fullscreen ? dom.reader : null,
      rootMargin: "-40% 0px -45% 0px",
      threshold: [0.05, 0.25, 0.5, 0.75],
    },
  );

  blocks.forEach((block) => pageObserver.observe(block));
}

function scrollToPage(pageNumber) {
  const target = document.getElementById(`page-${pageNumber}`);

  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollReaderToTop() {
  if (state.fullscreen) {
    dom.reader.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateScrollProgress() {
  const scrollableHeight = state.fullscreen
    ? dom.reader.scrollHeight - dom.reader.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight;

  const currentOffset = state.fullscreen ? dom.reader.scrollTop : window.scrollY;
  const progress = scrollableHeight <= 0 ? 0 : (currentOffset / scrollableHeight) * 100;

  dom.scrollProgressBar.style.width = `${Math.min(progress, 100)}%`;
}

function syncFullscreenToolbarOnScroll() {
  fullscreenScrollFrame = 0;
  updateScrollProgress();

  if (!state.fullscreen) {
    return;
  }

  const currentScrollTop = dom.reader.scrollTop;

  if (state.settingsOpen || currentScrollTop <= FULLSCREEN_TOOLBAR_TOP_ZONE) {
    setFullscreenToolbarVisible(true);
    return;
  }

  const travelSinceAnchor = currentScrollTop - state.toolbarScrollAnchor;

  if (travelSinceAnchor >= FULLSCREEN_TOOLBAR_HIDE_DISTANCE) {
    setFullscreenToolbarVisible(false);
    return;
  }

  if (travelSinceAnchor <= -FULLSCREEN_TOOLBAR_SHOW_DISTANCE) {
    setFullscreenToolbarVisible(true);
  }
}

function handleReaderScroll() {
  if (!state.fullscreen) {
    updateScrollProgress();
    return;
  }

  if (fullscreenScrollFrame) {
    return;
  }

  fullscreenScrollFrame = requestAnimationFrame(() => {
    syncFullscreenToolbarOnScroll();
  });
}

function handleReaderPanelPointerDown(event) {
  if (!state.fullscreen || !event.isPrimary) {
    return;
  }

  fullscreenTapStart = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
  };
}

function handleReaderPanelPointerUp(event) {
  if (!state.fullscreen || !event.isPrimary || !fullscreenTapStart) {
    return;
  }

  const tapStart = fullscreenTapStart;
  fullscreenTapStart = null;

  if (tapStart.id !== event.pointerId) {
    return;
  }

  const travelX = Math.abs(event.clientX - tapStart.x);
  const travelY = Math.abs(event.clientY - tapStart.y);
  const duration = event.timeStamp - tapStart.time;

  if (
    travelX > FULLSCREEN_TAP_MAX_DISTANCE
    || travelY > FULLSCREEN_TAP_MAX_DISTANCE
    || duration > FULLSCREEN_TAP_MAX_DURATION
  ) {
    return;
  }

  if (!(event.target instanceof Element)) {
    setFullscreenToolbarVisible(true);
    return;
  }

  const insideSettings = dom.fullscreenSettings.contains(event.target);
  const onSettingsToggle = dom.settingsToggle.contains(event.target);

  if (state.settingsOpen && !insideSettings && !onSettingsToggle) {
    closeFullscreenSettings();
  }

  setFullscreenToolbarVisible(true);
}

function clearFullscreenTapStart() {
  fullscreenTapStart = null;
}

function bindEvents() {
  dom.searchInput.addEventListener("input", (event) => {
    setSearchValue(event.target.value);
  });

  dom.fullscreenSearchInput.addEventListener("input", (event) => {
    setSearchValue(event.target.value);
  });

  dom.clearSearchButton.addEventListener("click", () => {
    setSearchValue("");
  });

  dom.fullscreenClearSearchButton.addEventListener("click", () => {
    setSearchValue("");
  });

  dom.topButton.addEventListener("click", () => {
    scrollReaderToTop();
  });

  dom.fullscreenTopButton.addEventListener("click", () => {
    scrollReaderToTop();
  });

  dom.backToTopButton.addEventListener("click", () => {
    scrollReaderToTop();
  });

  dom.pageJump.addEventListener("change", (event) => {
    scrollToPage(Number(event.target.value));
  });

  dom.fullscreenPageJump.addEventListener("change", (event) => {
    scrollToPage(Number(event.target.value));
  });

  dom.modeToggle.addEventListener("click", () => {
    setLarivaarMode(true);
  });

  dom.assistToggle.addEventListener("click", () => {
    setLarivaarMode(false);
  });

  dom.fullscreenModeToggle.addEventListener("click", () => {
    setLarivaarMode(true);
  });

  dom.fullscreenAssistToggle.addEventListener("click", () => {
    setLarivaarMode(false);
  });

  dom.settingsToggle.addEventListener("click", () => {
    state.settingsOpen = !state.settingsOpen;
    syncSettingsPanel();
  });

  dom.fullscreenToggle.addEventListener("click", () => {
    toggleReaderFullscreen();
  });

  dom.fontSizeInput.addEventListener("input", (event) => {
    setFontSize(event.target.value);
  });

  dom.fullscreenFontSizeInput.addEventListener("input", (event) => {
    setFontSize(event.target.value);
  });

  dom.lineHeightInput.addEventListener("input", (event) => {
    setLineHeight(event.target.value);
  });

  dom.fullscreenLineHeightInput.addEventListener("input", (event) => {
    setLineHeight(event.target.value);
  });

  dom.measureInput.addEventListener("input", (event) => {
    setMeasure(event.target.value);
  });

  dom.fullscreenMeasureInput.addEventListener("input", (event) => {
    setMeasure(event.target.value);
  });

  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", scheduleLineFit, { passive: true });
  window.addEventListener("orientationchange", scheduleLineFit, { passive: true });
  dom.reader.addEventListener("scroll", handleReaderScroll, { passive: true });
  dom.readerPanel.addEventListener("pointerdown", handleReaderPanelPointerDown, { passive: true });
  dom.readerPanel.addEventListener("pointerup", handleReaderPanelPointerUp, { passive: true });
  dom.readerPanel.addEventListener("pointercancel", clearFullscreenTapStart, { passive: true });
  document.addEventListener("fullscreenchange", syncFullscreenState);
  document.addEventListener("webkitfullscreenchange", syncFullscreenState);
}

function initialize() {
  if (!payload || !Array.isArray(payload.pages) || payload.pages.length === 0) {
    dom.readerStatus.textContent = "The local Sukhmani Sahib data file is missing. Run the build script first.";
    return;
  }

  readSettings();
  applyReaderPreferences();
  bindEvents();
  buildPageOptions();
  syncFullscreenState();

  dom.audioPlayer.src = payload.metadata.audioUrl;
  dom.fullscreenAudioPlayer.src = payload.metadata.audioUrl;
  dom.statPages.textContent = `${payload.metadata.totalPages} pages`;
  dom.statLines.textContent = `${payload.metadata.totalLines} lines`;
  dom.dataSummary.textContent = `Prepared on ${new Date(payload.metadata.generatedAt).toLocaleString()}.`;
  dom.fullscreenSearchInput.value = state.search;

  renderReader();
  updateScrollProgress();
}

initialize();