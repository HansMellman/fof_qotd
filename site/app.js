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
const todayQuoteDate = document.querySelector("#todayQuoteDate");
const todayQuoteText = document.querySelector("#todayQuoteText");
const todayQuoteAuthor = document.querySelector("#todayQuoteAuthor");
const todayCopyButton = document.querySelector("#todayCopyButton");
const todayScreenshotButton = document.querySelector("#todayScreenshotButton");
const screenshotModal = document.querySelector("#screenshotModal");
const modalCloseButton = document.querySelector("#modalCloseButton");
const modalTitle = document.querySelector("#modalTitle");
const modalSubtitle = document.querySelector("#modalSubtitle");
const modalImage = document.querySelector("#modalImage");

let quotes = [];
let currentTodayQuote = null;

function normalizeText(value) {
  return String(value || "").toLowerCase();
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

function shouldShowQuote(quote) {
  const searchTerm = normalizeText(searchInput.value.trim());
  const selectedMonth = monthFilter.value;
  const selectedAuthor = authorFilter.value;
  const includeSpecials = specialToggle.checked;

  if (!includeSpecials && !quote.include_in_default_archive) {
    return false;
  }

  if (selectedMonth && String(quote.month_number) !== selectedMonth) {
    return false;
  }

  if (selectedAuthor && quote.author !== selectedAuthor) {
    return false;
  }

  return matchesSearch(quote, searchTerm);
}

function getFilteredQuotes() {
  return quotes.filter(shouldShowQuote);
}

function formatSpecialLabel(specialType) {
  return specialType.replaceAll("_", " ");
}

async function copyQuote(quote, button) {
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

function getTodayQuote() {
  const today = new Date();
  const dateKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return quotes.find((quote) => quote.date_key === dateKey && quote.include_in_default_archive) || quotes[0] || null;
}

function renderTodayQuote(quote) {
  currentTodayQuote = quote;

  if (!quote) {
    todayQuoteDate.textContent = "No quote loaded";
    todayQuoteText.textContent = "Could not load the archive.";
    todayQuoteAuthor.textContent = "";
    todayCopyButton.disabled = true;
    todayScreenshotButton.disabled = true;
    return;
  }

  todayQuoteDate.textContent = quote.date_label;
  todayQuoteText.textContent = quote.text || "[Needs review]";
  todayQuoteAuthor.textContent = quote.author ? `- ${quote.author}` : "";
  todayCopyButton.disabled = false;
  todayScreenshotButton.disabled = !quote.image_path;
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

function updateResults() {
  const visibleQuotes = getFilteredQuotes();
  renderQuotes(visibleQuotes);
  renderAuthorIndex();
}

function populateMonthFilter() {
  const monthMap = new Map();
  for (const quote of quotes) {
    monthMap.set(String(quote.month_number), quote.month_name);
  }

  const sortedMonths = [...monthMap.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [monthNumber, monthName] of sortedMonths) {
    const option = document.createElement("option");
    option.value = monthNumber;
    option.textContent = monthName;
    monthFilter.append(option);
  }
}

function populateAuthorFilter() {
  const authorCounts = getAuthorCounts();
  for (const [author, count] of authorCounts) {
    if (!author) {
      continue;
    }
    const option = document.createElement("option");
    option.value = author;
    option.textContent = `${author} (${count})`;
    authorFilter.append(option);
  }
}

function getAuthorCounts() {
  const counts = new Map();
  for (const quote of quotes) {
    const author = quote.author || "";
    counts.set(author, (counts.get(author) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderAuthorIndex() {
  authorList.replaceChildren();

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `author-button${authorFilter.value === "" ? " active" : ""}`;
  allButton.innerHTML = `<span>All Authors</span><span class="author-count">${quotes.length}</span>`;
  allButton.addEventListener("click", () => {
    authorFilter.value = "";
    updateResults();
  });
  authorList.append(allButton);

  for (const [author, count] of getAuthorCounts()) {
    if (!author) {
      continue;
    }
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

function showTodayQuote() {
  searchInput.value = "";
  monthFilter.value = "";
  authorFilter.value = "";
  specialToggle.checked = false;

  const todayQuote = getTodayQuote();
  renderTodayQuote(todayQuote);
  if (todayQuote) {
    renderQuotes([todayQuote]);
    resultCount.textContent = "1 result";
  } else {
    resultCount.textContent = "0 results";
    quoteGrid.replaceChildren();
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No default quote is available for today.";
    quoteGrid.append(message);
  }
}

function showRandomQuote() {
  const pool = getFilteredQuotes();
  if (pool.length === 0) {
    renderQuotes([]);
    return;
  }

  const quote = pool[Math.floor(Math.random() * pool.length)];
  renderTodayQuote(quote);
  renderQuotes([quote]);
  resultCount.textContent = "1 result";
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
    populateMonthFilter();
    populateAuthorFilter();
    renderTodayQuote(getTodayQuote());
    updateResults();
  } catch (error) {
    renderTodayQuote(null);
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
todayCopyButton.addEventListener("click", () => copyQuote(currentTodayQuote, todayCopyButton));
todayScreenshotButton.addEventListener("click", () => openScreenshotModal(currentTodayQuote));
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
