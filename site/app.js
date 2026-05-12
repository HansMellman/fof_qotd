const DATA_URL = "data/quotes.json";

const searchInput = document.querySelector("#searchInput");
const monthFilter = document.querySelector("#monthFilter");
const authorFilter = document.querySelector("#authorFilter");
const specialToggle = document.querySelector("#specialToggle");
const todayButton = document.querySelector("#todayButton");
const randomButton = document.querySelector("#randomButton");
const clearButton = document.querySelector("#clearButton");
const resultCount = document.querySelector("#resultCount");
const quoteGrid = document.querySelector("#quoteGrid");
const template = document.querySelector("#quoteCardTemplate");
const authorList = document.querySelector("#authorList");
const archiveCount = document.querySelector("#archiveCount");
const heroLabel = document.querySelector("#heroLabel");
const todayQuoteDate = document.querySelector("#todayQuoteDate");
const todayQuoteText = document.querySelector("#todayQuoteText");
const todayQuoteAuthor = document.querySelector("#todayQuoteAuthor");
const heroPreviousButton = document.querySelector("#heroPreviousButton");
const heroNextButton = document.querySelector("#heroNextButton");
const todayCopyButton = document.querySelector("#todayCopyButton");
const todayScreenshotButton = document.querySelector("#todayScreenshotButton");
const screenshotModal = document.querySelector("#screenshotModal");
const modalCloseButton = document.querySelector("#modalCloseButton");
const modalTitle = document.querySelector("#modalTitle");
const modalSubtitle = document.querySelector("#modalSubtitle");
const modalImage = document.querySelector("#modalImage");

let quotes = [];
let currentHeroQuote = null;
let heroPool = [];
let heroIndex = 0;
let heroMode = "today";

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function getBasePool() {
  if (specialToggle.checked) {
    return [...quotes];
  }
  return quotes.filter((quote) => quote.include_in_default_archive);
}

function matchesSearch(quote, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const searchableText = [
    quote.text,
    quote.author,
    quote.date_label,
    quote.notes,
  ].map(normalizeText).join(" ");

  return searchableText.includes(searchTerm);
}

function hasActiveFilters() {
  return Boolean(
    searchInput.value.trim()
    || monthFilter.value
    || authorFilter.value
    || specialToggle.checked
  );
}

function getFilteredQuotes() {
  const searchTerm = normalizeText(searchInput.value.trim());
  const selectedMonth = monthFilter.value;
  const selectedAuthor = authorFilter.value;

  return getBasePool().filter((quote) => {
    if (selectedMonth && String(quote.month_number) !== selectedMonth) {
      return false;
    }

    if (selectedAuthor && quote.author !== selectedAuthor) {
      return false;
    }

    return matchesSearch(quote, searchTerm);
  });
}

function getAvailableMonths(authorValue = authorFilter.value) {
  const monthMap = new Map();
  for (const quote of getBasePool()) {
    if (authorValue && quote.author !== authorValue) {
      continue;
    }
    monthMap.set(String(quote.month_number), quote.month_name);
  }
  return monthMap;
}

function getAvailableAuthors(monthValue = monthFilter.value) {
  const counts = new Map();
  for (const quote of getBasePool()) {
    if (monthValue && String(quote.month_number) !== monthValue) {
      continue;
    }
    if (!quote.author) {
      continue;
    }
    counts.set(quote.author, (counts.get(quote.author) || 0) + 1);
  }
  return counts;
}

function getAuthorIndexCounts() {
  return getAvailableAuthors(monthFilter.value);
}

function setSelectOptions(selectElement, defaultLabel, entries, selectedValue) {
  selectElement.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  selectElement.append(defaultOption);

  for (const [value, label] of entries) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    selectElement.append(option);
  }

  selectElement.value = selectedValue;
}

function updateFilterOptions() {
  let selectedMonth = monthFilter.value;
  let selectedAuthor = authorFilter.value;

  for (let index = 0; index < 3; index += 1) {
    const availableAuthors = getAvailableAuthors(selectedMonth);
    if (selectedAuthor && !availableAuthors.has(selectedAuthor)) {
      selectedAuthor = "";
    }

    const availableMonths = getAvailableMonths(selectedAuthor);
    if (selectedMonth && !availableMonths.has(selectedMonth)) {
      selectedMonth = "";
    }
  }

  const monthEntries = [...getAvailableMonths(selectedAuthor).entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const authorEntries = [...getAvailableAuthors(selectedMonth).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([author, count]) => [author, `${author} (${count})`]);

  setSelectOptions(monthFilter, "All months", monthEntries, selectedMonth);
  setSelectOptions(authorFilter, "All authors", authorEntries, selectedAuthor);
}

function formatSpecialLabel(specialType) {
  return specialType.replaceAll("_", " ");
}

function getHeroAuthorLabel(author) {
  let label = author || "Unknown Author";
  label = label.replace(/\([^)]*\)/g, "").trim();
  label = label.split(",")[0].trim();
  return label.toUpperCase();
}

function getTodayQuote() {
  const today = new Date();
  const dateKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return quotes.find((quote) => quote.date_key === dateKey && quote.include_in_default_archive) || quotes[0] || null;
}

function updateHeroNav() {
  const canNavigate = heroPool.length > 1 && heroMode === "filtered";
  heroPreviousButton.hidden = !canNavigate;
  heroNextButton.hidden = !canNavigate;
  heroPreviousButton.disabled = !canNavigate;
  heroNextButton.disabled = !canNavigate;
}

function getHeroLabel(mode, quote, index, pool) {
  if (mode === "today") {
    return "TODAY'S QUOTE";
  }
  if (mode === "random") {
    return "RANDOM QUOTE";
  }
  if (!quote || pool.length === 0) {
    return "NO MATCHING QUOTES";
  }
  return `${getHeroAuthorLabel(quote.author)} · ${index + 1} OF ${pool.length}`;
}

function setHeroQuote(quote, mode = "filtered", pool = [], index = 0) {
  currentHeroQuote = quote;
  heroMode = mode;
  heroPool = [...pool];
  heroIndex = index;
  heroLabel.textContent = getHeroLabel(mode, quote, index, heroPool);

  if (!quote) {
    todayQuoteDate.textContent = "No matching quote";
    todayQuoteText.textContent = "No quotes match the current filters. Try clearing search, changing month or author, or including special quotes.";
    todayQuoteAuthor.textContent = "";
    todayCopyButton.disabled = true;
    todayScreenshotButton.disabled = true;
    updateHeroNav();
    return;
  }

  todayQuoteDate.textContent = quote.date_label;
  todayQuoteText.textContent = quote.text || "[Needs review]";
  todayQuoteAuthor.textContent = quote.author ? `- ${quote.author}` : "";
  todayCopyButton.disabled = false;
  todayScreenshotButton.disabled = !quote.image_path;
  updateHeroNav();
}

function setHeroFromFilteredResults(visibleQuotes) {
  if (!hasActiveFilters()) {
    const todayQuote = getTodayQuote();
    setHeroQuote(todayQuote, "today", todayQuote ? [todayQuote] : [], 0);
    return;
  }

  if (visibleQuotes.length === 0) {
    setHeroQuote(null, "filtered", [], 0);
    return;
  }

  setHeroQuote(visibleQuotes[0], "filtered", visibleQuotes, 0);
}

function nextHeroQuote() {
  if (heroPool.length <= 1) {
    return;
  }
  const nextIndex = (heroIndex + 1) % heroPool.length;
  setHeroQuote(heroPool[nextIndex], "filtered", heroPool, nextIndex);
}

function previousHeroQuote() {
  if (heroPool.length <= 1) {
    return;
  }
  const previousIndex = (heroIndex - 1 + heroPool.length) % heroPool.length;
  setHeroQuote(heroPool[previousIndex], "filtered", heroPool, previousIndex);
}

async function copyQuote(quote, button) {
  if (!quote) {
    return;
  }

  const authorText = quote.author ? ` - ${quote.author}` : "";
  const text = `${quote.text}${authorText}`;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch (error) {
    button.textContent = "Copy failed";
  }

  window.setTimeout(() => {
    button.textContent = "Copy quote";
  }, 1400);
}

function openScreenshotModal(quote) {
  if (!quote || !quote.image_path) {
    return;
  }

  modalTitle.textContent = quote.date_label;
  modalSubtitle.textContent = quote.author || "Original screenshot";
  modalImage.src = quote.image_path;
  modalImage.alt = `Original screenshot for ${quote.date_label}`;
  screenshotModal.hidden = false;
  modalCloseButton.focus();
}

function closeScreenshotModal() {
  screenshotModal.hidden = true;
  modalImage.removeAttribute("src");
}

function renderQuotes(visibleQuotes) {
  quoteGrid.replaceChildren();
  resultCount.textContent = `${visibleQuotes.length} result${visibleQuotes.length === 1 ? "" : "s"}`;

  if (visibleQuotes.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = quotes.length === 0
      ? "No quotes found. Build site/data/quotes.json to populate the archive."
      : "No quotes match the current filters.";
    quoteGrid.append(message);
    return;
  }

  for (const quote of visibleQuotes) {
    const card = template.content.cloneNode(true);
    const article = card.querySelector(".quote-card");
    const title = card.querySelector("h2");
    const badge = card.querySelector(".badge");
    const blockquote = card.querySelector("blockquote");
    const author = card.querySelector(".author");
    const copyButton = card.querySelector(".copy-button");
    const screenshotButton = card.querySelector(".screenshot-button");

    title.textContent = quote.date_label;
    blockquote.textContent = quote.text || "[Needs review]";

    if (quote.special_type) {
      badge.hidden = false;
      badge.textContent = formatSpecialLabel(quote.special_type);
    }

    if (quote.author) {
      author.hidden = false;
      author.textContent = quote.author;
    }

    copyButton.addEventListener("click", () => copyQuote(quote, copyButton));
    if (quote.image_path) {
      screenshotButton.addEventListener("click", () => openScreenshotModal(quote));
    } else {
      screenshotButton.disabled = true;
    }
    article.dataset.quoteId = quote.id;
    quoteGrid.append(card);
  }
}

function updateAuthorIndex() {
  authorList.replaceChildren();

  const authorCounts = getAuthorIndexCounts();
  const totalCount = [...authorCounts.values()].reduce((sum, count) => sum + count, 0);
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `author-button${authorFilter.value === "" ? " active" : ""}`;
  allButton.innerHTML = `<span>All Authors</span><span class="author-count">${totalCount}</span>`;
  allButton.addEventListener("click", () => {
    authorFilter.value = "";
    updateResults();
  });
  authorList.append(allButton);

  for (const [author, count] of [...authorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `author-button${authorFilter.value === author ? " active" : ""}`;
    button.innerHTML = `<span></span><span class="author-count">${count}</span>`;
    button.querySelector("span").textContent = author;
    button.addEventListener("click", () => {
      authorFilter.value = author;
      updateResults();
    });
    authorList.append(button);
  }
}

function updateResults() {
  updateFilterOptions();
  const visibleQuotes = getFilteredQuotes();
  renderQuotes(visibleQuotes);
  updateAuthorIndex();
  setHeroFromFilteredResults(visibleQuotes);
}

function showTodayQuote() {
  const todayQuote = getTodayQuote();
  setHeroQuote(todayQuote, "today", todayQuote ? [todayQuote] : [], 0);
}

function showRandomQuote() {
  const pool = hasActiveFilters() ? getFilteredQuotes() : getBasePool();
  if (pool.length === 0) {
    setHeroQuote(null, "random", [], 0);
    return;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  setHeroQuote(pool[randomIndex], "random", pool, randomIndex);
}

function clearFilters() {
  searchInput.value = "";
  monthFilter.value = "";
  authorFilter.value = "";
  specialToggle.checked = false;
  updateResults();
}

async function loadQuotes() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    quotes = await response.json();
    archiveCount.textContent = String(quotes.length);
    updateResults();
  } catch (error) {
    setHeroQuote(null, "filtered", [], 0);
    resultCount.textContent = "Could not load quotes";
    quoteGrid.replaceChildren();
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "Could not load site/data/quotes.json. If you opened this file directly, try a local server.";
    quoteGrid.append(message);
  }
}

searchInput.addEventListener("input", updateResults);
monthFilter.addEventListener("change", updateResults);
authorFilter.addEventListener("change", updateResults);
specialToggle.addEventListener("change", updateResults);
todayButton.addEventListener("click", showTodayQuote);
randomButton.addEventListener("click", showRandomQuote);
clearButton.addEventListener("click", clearFilters);
heroPreviousButton.addEventListener("click", previousHeroQuote);
heroNextButton.addEventListener("click", nextHeroQuote);
todayCopyButton.addEventListener("click", () => copyQuote(currentHeroQuote, todayCopyButton));
todayScreenshotButton.addEventListener("click", () => openScreenshotModal(currentHeroQuote));
modalCloseButton.addEventListener("click", closeScreenshotModal);
screenshotModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-modal")) {
    closeScreenshotModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !screenshotModal.hidden) {
    closeScreenshotModal();
  }
});

loadQuotes();
