const DATA_URL = "data/quotes.json";

const searchInput = document.querySelector("#searchInput");
const monthFilter = document.querySelector("#monthFilter");
const specialToggle = document.querySelector("#specialToggle");
const todayButton = document.querySelector("#todayButton");
const randomButton = document.querySelector("#randomButton");
const clearButton = document.querySelector("#clearButton");
const resultCount = document.querySelector("#resultCount");
const quoteGrid = document.querySelector("#quoteGrid");
const template = document.querySelector("#quoteCardTemplate");

let quotes = [];

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
  const includeSpecials = specialToggle.checked;

  if (!includeSpecials && !quote.include_in_default_archive) {
    return false;
  }

  if (selectedMonth && String(quote.month_number) !== selectedMonth) {
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
    const image = card.querySelector("img");
    const copyButton = card.querySelector(".copy-button");

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

    if (quote.image_path) {
      image.src = quote.image_path;
      image.alt = `Original screenshot for ${quote.date_label}`;
    } else {
      image.remove();
    }

    copyButton.addEventListener("click", () => copyQuote(quote, copyButton));
    article.dataset.quoteId = quote.id;
    quoteGrid.append(card);
  }
}

function updateResults() {
  renderQuotes(getFilteredQuotes());
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

function showTodayQuote() {
  const today = new Date();
  const dateKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  searchInput.value = "";
  monthFilter.value = "";

  const todayQuote = quotes.find((quote) => quote.date_key === dateKey && quote.include_in_default_archive);
  if (todayQuote) {
    renderQuotes([todayQuote]);
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
  renderQuotes([quote]);
}

function clearFilters() {
  searchInput.value = "";
  monthFilter.value = "";
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
    populateMonthFilter();
    updateResults();
  } catch (error) {
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
specialToggle.addEventListener("change", updateResults);
todayButton.addEventListener("click", showTodayQuote);
randomButton.addEventListener("click", showRandomQuote);
clearButton.addEventListener("click", clearFilters);

loadQuotes();
