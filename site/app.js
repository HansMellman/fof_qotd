const DATA_URL = "data/quotes.json";
const AUTHORS_URL = "data/authors.json";

const searchInput = document.querySelector("#searchInput");
const monthFilter = document.querySelector("#monthFilter");
const authorFilter = document.querySelector("#authorFilter");
const specialToggle = document.querySelector("#specialToggle");
const todayButton = document.querySelector("#todayButton");
const randomButton = document.querySelector("#randomButton");
const quizButton = document.querySelector("#quizButton");
const topAboutAuthorsButton = document.querySelector("#topAboutAuthorsButton");
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
const aboutAuthorsButton = document.querySelector("#aboutAuthorsButton");
const authorsModal = document.querySelector("#authorsModal");
const authorsCloseButton = document.querySelector("#authorsCloseButton");
const authorMetadataSearch = document.querySelector("#authorMetadataSearch");
const authorTypeFilter = document.querySelector("#authorTypeFilter");
const authorMetadataCount = document.querySelector("#authorMetadataCount");
const authorMetadataGrid = document.querySelector("#authorMetadataGrid");
const quizModal = document.querySelector("#quizModal");
const quizCloseButton = document.querySelector("#quizCloseButton");
const quizScore = document.querySelector("#quizScore");
const quizStreak = document.querySelector("#quizStreak");
const quizBestStreakLabel = document.querySelector("#quizBestStreak");
const quizStatus = document.querySelector("#quizStatus");
const quizDate = document.querySelector("#quizDate");
const quizQuoteText = document.querySelector("#quizQuoteText");
const quizChoices = document.querySelector("#quizChoices");
const quizFeedback = document.querySelector("#quizFeedback");
const quizNextButton = document.querySelector("#quizNextButton");
const quizRestartButton = document.querySelector("#quizRestartButton");
const backToTopButton = document.querySelector("#backToTopButton");

const AUTHOR_TYPE_LABELS = {
  real_football_person: "Real Football People",
  literary_character: "Literary Characters",
  real_historical_person: "Historical / Public Figures",
  film_or_pop_culture_character: "Film / Pop Culture",
  fof_universe_fictional: "FOF Universe Fictional",
  developer: "Developer / Meta",
  writer: "Writers",
  philosopher: "Philosophers",
  musician: "Musicians",
  unknown: "Unknown",
};

let quotes = [];
let authors = [];
let authorsLoadError = "";
let currentHeroQuote = null;
let heroPool = [];
let heroIndex = 0;
let heroMode = "today";
let quizCurrentQuote = null;
let quizPreviousQuoteId = "";
let quizAnswered = false;
let quizCorrectCount = 0;
let quizAnsweredCount = 0;
let quizCurrentStreak = 0;
let quizBestStreak = 0;

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

function getAuthorTypeLabel(authorType) {
  if (!authorType) {
    return "Unclassified";
  }
  return AUTHOR_TYPE_LABELS[authorType] || authorType.replaceAll("_", " ");
}

function getAuthorDisplayName(fullAuthor) {
  const metadata = getAuthorMetadata(fullAuthor);
  if (metadata && metadata.display_name) {
    return metadata.display_name;
  }

  let displayName = fullAuthor || "Unknown Author";
  displayName = displayName.replace(/\([^)]*\)/g, "").trim();
  displayName = displayName.split(",")[0].trim();
  return displayName || fullAuthor || "Unknown Author";
}

function getAuthorMetadata(fullAuthor) {
  return authors.find((author) => author.full_author === fullAuthor) || null;
}

function getAuthorSearchText(author) {
  return [
    author.display_name,
    author.full_author,
    author.author_type,
    author.source_title,
    author.source_creator,
    author.fof_role,
    author.short_note,
    Array.isArray(author.tags) ? author.tags.join(" ") : "",
  ].map(normalizeText).join(" ");
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

function populateAuthorTypeFilter() {
  const selectedValue = authorTypeFilter.value;
  authorTypeFilter.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "All author types";
  authorTypeFilter.append(defaultOption);

  const authorTypes = [...new Set(authors.map((author) => author.author_type).filter(Boolean))]
    .sort((a, b) => getAuthorTypeLabel(a).localeCompare(getAuthorTypeLabel(b)));

  for (const authorType of authorTypes) {
    const option = document.createElement("option");
    option.value = authorType;
    option.textContent = getAuthorTypeLabel(authorType);
    authorTypeFilter.append(option);
  }

  if ([...authorTypeFilter.options].some((option) => option.value === selectedValue)) {
    authorTypeFilter.value = selectedValue;
  }
}

function getFilteredAuthors() {
  const searchTerm = normalizeText(authorMetadataSearch.value.trim());
  const selectedType = authorTypeFilter.value;

  return authors.filter((author) => {
    if (selectedType && author.author_type !== selectedType) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }
    return getAuthorSearchText(author).includes(searchTerm);
  });
}

function renderAuthorMetadataCards() {
  authorMetadataGrid.replaceChildren();

  if (authorsLoadError) {
    authorMetadataCount.textContent = "Author metadata unavailable";
    const message = document.createElement("p");
    message.className = "author-metadata-empty";
    message.textContent = authorsLoadError;
    authorMetadataGrid.append(message);
    return;
  }

  const visibleAuthors = getFilteredAuthors();
  authorMetadataCount.textContent = `${visibleAuthors.length} author${visibleAuthors.length === 1 ? "" : "s"}`;

  if (visibleAuthors.length === 0) {
    const message = document.createElement("p");
    message.className = "author-metadata-empty";
    message.textContent = "No authors match the current filters.";
    authorMetadataGrid.append(message);
    return;
  }

  for (const author of visibleAuthors) {
    const card = document.createElement("article");
    card.className = "author-metadata-card";

    const title = document.createElement("h3");
    title.textContent = author.display_name || author.full_author;
    card.append(title);

    const typeLine = document.createElement("p");
    typeLine.className = "author-type-line";
    typeLine.textContent = `${getAuthorTypeLabel(author.author_type)} · ${author.quote_count} quote${author.quote_count === 1 ? "" : "s"}`;
    card.append(typeLine);

    const details = document.createElement("dl");
    details.className = "author-detail-list";
    const detailItems = [
      ["Source", author.source_title],
      ["Creator", author.source_creator],
      ["FOF role", author.fof_role],
    ];

    for (const [label, value] of detailItems) {
      if (!value) {
        continue;
      }
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = `${label}: `;
      description.textContent = value;
      wrapper.append(term, description);
      details.append(wrapper);
    }
    if (details.children.length > 0) {
      card.append(details);
    }

    if (author.short_note) {
      const note = document.createElement("p");
      note.textContent = author.short_note;
      card.append(note);
    }

    if (Array.isArray(author.tags) && author.tags.length > 0) {
      const tags = document.createElement("div");
      tags.className = "author-tag-list";
      for (const tagText of author.tags) {
        const tag = document.createElement("span");
        tag.className = "author-tag";
        tag.textContent = tagText;
        tags.append(tag);
      }
      card.append(tags);
    }

    const actions = document.createElement("div");
    actions.className = "author-card-actions";
    const viewQuotesButton = document.createElement("button");
    viewQuotesButton.type = "button";
    viewQuotesButton.textContent = "View Quotes";
    viewQuotesButton.addEventListener("click", () => viewQuotesForAuthor(author.full_author));
    actions.append(viewQuotesButton);
    card.append(actions);

    authorMetadataGrid.append(card);
  }
}

function openAuthorsModal() {
  authorsModal.hidden = false;
  renderAuthorMetadataCards();
  authorMetadataSearch.focus();
}

function closeAuthorsModal() {
  authorsModal.hidden = true;
}

function viewQuotesForAuthor(fullAuthor) {
  closeAuthorsModal();
  searchInput.value = "";
  monthFilter.value = "";
  if (!getAvailableAuthors("").has(fullAuthor)) {
    specialToggle.checked = true;
  }
  updateFilterOptions();
  authorFilter.value = fullAuthor;
  updateResults();
  document.querySelector(".main-content").scrollIntoView({ block: "start" });
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getQuizQuotePool() {
  return getBasePool().filter((quote) => quote.author && quote.text);
}

function getQuizAuthorPool() {
  const authorsByName = new Map();
  for (const quote of getQuizQuotePool()) {
    if (quote.author) {
      authorsByName.set(quote.author, quote.author);
    }
  }
  return [...authorsByName.keys()];
}

function updateQuizScore() {
  quizScore.textContent = `Score: ${quizCorrectCount} / ${quizAnsweredCount}`;
  quizStreak.textContent = `Streak: ${quizCurrentStreak}`;
  quizBestStreakLabel.textContent = `Best: ${quizBestStreak}`;
}

function setQuizMessage(message) {
  quizDate.textContent = "";
  quizQuoteText.textContent = message;
  quizChoices.replaceChildren();
  quizFeedback.replaceChildren();
  quizNextButton.disabled = true;
}

function buildAnswerChoices(quote, authorPool) {
  const distractors = shuffleArray(authorPool.filter((author) => author !== quote.author)).slice(0, 3);
  return shuffleArray([quote.author, ...distractors]);
}

function buildQuizQuestion() {
  updateQuizScore();
  quizStatus.textContent = "";
  quizFeedback.replaceChildren();
  quizChoices.replaceChildren();
  quizAnswered = false;
  quizNextButton.disabled = true;

  if (quotes.length === 0) {
    setQuizMessage("Quote data is not loaded yet. Try again after the archive finishes loading.");
    return;
  }

  const pool = getQuizQuotePool();
  if (pool.length === 0) {
    setQuizMessage("No quiz quotes are available for the current special quote setting.");
    return;
  }

  const authorPool = getQuizAuthorPool();
  if (authorPool.length < 4) {
    setQuizMessage("The quiz needs at least four available authors to build answer choices.");
    return;
  }

  let questionPool = pool;
  if (pool.length > 1 && quizPreviousQuoteId) {
    questionPool = pool.filter((quote) => quote.id !== quizPreviousQuoteId);
  }

  quizCurrentQuote = questionPool[Math.floor(Math.random() * questionPool.length)];
  quizPreviousQuoteId = quizCurrentQuote.id;
  quizDate.textContent = quizCurrentQuote.date_label || "";
  quizQuoteText.textContent = quizCurrentQuote.text || "[Needs review]";

  for (const author of buildAnswerChoices(quizCurrentQuote, authorPool)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-choice-button";
    button.textContent = getAuthorDisplayName(author);
    button.dataset.author = author;
    button.addEventListener("click", () => handleQuizAnswer(author));
    quizChoices.append(button);
  }
}

function renderQuizFeedback(selectedAuthor, isCorrect) {
  quizFeedback.replaceChildren();

  const result = document.createElement("p");
  result.className = isCorrect ? "quiz-result correct" : "quiz-result incorrect";
  result.textContent = isCorrect ? "Correct!" : "Not quite.";
  quizFeedback.append(result);

  const answer = document.createElement("p");
  answer.textContent = isCorrect
    ? `That was ${quizCurrentQuote.author}.`
    : `Correct answer: ${quizCurrentQuote.author}.`;
  quizFeedback.append(answer);

  if (!isCorrect) {
    const selected = document.createElement("p");
    selected.textContent = `Your answer: ${selectedAuthor}.`;
    quizFeedback.append(selected);
  }

  const metadata = getAuthorMetadata(quizCurrentQuote.author);
  if (!metadata) {
    return;
  }

  const details = document.createElement("dl");
  details.className = "quiz-author-details";
  const detailItems = [
    ["Type", getAuthorTypeLabel(metadata.author_type)],
    ["Source", metadata.source_title],
    ["Creator", metadata.source_creator],
    ["FOF role", metadata.fof_role],
  ];

  for (const [label, value] of detailItems) {
    if (!value) {
      continue;
    }
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = `${label}: `;
    description.textContent = value;
    wrapper.append(term, description);
    details.append(wrapper);
  }

  if (details.children.length > 0) {
    quizFeedback.append(details);
  }

  if (metadata.short_note) {
    const note = document.createElement("p");
    note.className = "quiz-author-note";
    note.textContent = metadata.short_note;
    quizFeedback.append(note);
  }
}

function handleQuizAnswer(selectedAuthor) {
  if (quizAnswered || !quizCurrentQuote) {
    return;
  }

  quizAnswered = true;
  quizAnsweredCount += 1;
  const isCorrect = selectedAuthor === quizCurrentQuote.author;

  if (isCorrect) {
    quizCorrectCount += 1;
    quizCurrentStreak += 1;
    quizBestStreak = Math.max(quizBestStreak, quizCurrentStreak);
  } else {
    quizCurrentStreak = 0;
  }

  for (const button of quizChoices.querySelectorAll("button")) {
    button.disabled = true;
    if (button.dataset.author === quizCurrentQuote.author) {
      button.classList.add("correct");
      button.setAttribute("aria-label", `${button.textContent}, correct answer`);
    } else if (button.dataset.author === selectedAuthor) {
      button.classList.add("incorrect");
      button.setAttribute("aria-label", `${button.textContent}, your answer`);
    }
  }

  renderQuizFeedback(selectedAuthor, isCorrect);
  updateQuizScore();
  quizNextButton.disabled = false;
  quizNextButton.focus();
}

function resetQuiz() {
  quizCorrectCount = 0;
  quizAnsweredCount = 0;
  quizCurrentStreak = 0;
  quizBestStreak = 0;
  quizPreviousQuoteId = "";
  buildQuizQuestion();
}

function openQuizModal() {
  quizModal.hidden = false;
  resetQuiz();
  quizCloseButton.focus();
}

function closeQuizModal() {
  quizModal.hidden = true;
}

function updateBackToTopButton() {
  backToTopButton.hidden = window.scrollY < 520;
}

function scrollBackToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
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

async function loadAuthors() {
  try {
    const response = await fetch(AUTHORS_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    authors = await response.json();
    authors.sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));
    authorsLoadError = "";
    populateAuthorTypeFilter();
    renderAuthorMetadataCards();
  } catch (error) {
    authors = [];
    authorsLoadError = "Could not load site/data/authors.json. The quote archive still works, but author notes are unavailable.";
    populateAuthorTypeFilter();
    renderAuthorMetadataCards();
  }
}

searchInput.addEventListener("input", updateResults);
monthFilter.addEventListener("change", updateResults);
authorFilter.addEventListener("change", updateResults);
specialToggle.addEventListener("change", updateResults);
todayButton.addEventListener("click", showTodayQuote);
randomButton.addEventListener("click", showRandomQuote);
quizButton.addEventListener("click", openQuizModal);
topAboutAuthorsButton.addEventListener("click", openAuthorsModal);
clearButton.addEventListener("click", clearFilters);
heroPreviousButton.addEventListener("click", previousHeroQuote);
heroNextButton.addEventListener("click", nextHeroQuote);
todayCopyButton.addEventListener("click", () => copyQuote(currentHeroQuote, todayCopyButton));
todayScreenshotButton.addEventListener("click", () => openScreenshotModal(currentHeroQuote));
aboutAuthorsButton.addEventListener("click", openAuthorsModal);
authorsCloseButton.addEventListener("click", closeAuthorsModal);
quizCloseButton.addEventListener("click", closeQuizModal);
quizNextButton.addEventListener("click", buildQuizQuestion);
quizRestartButton.addEventListener("click", resetQuiz);
backToTopButton.addEventListener("click", scrollBackToTop);
authorMetadataSearch.addEventListener("input", renderAuthorMetadataCards);
authorTypeFilter.addEventListener("change", renderAuthorMetadataCards);
modalCloseButton.addEventListener("click", closeScreenshotModal);
screenshotModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-modal")) {
    closeScreenshotModal();
  }
});
authorsModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-authors")) {
    closeAuthorsModal();
  }
});
quizModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-quiz")) {
    closeQuizModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!screenshotModal.hidden) {
    closeScreenshotModal();
  }
  if (!authorsModal.hidden) {
    closeAuthorsModal();
  }
  if (!quizModal.hidden) {
    closeQuizModal();
  }
});
window.addEventListener("scroll", updateBackToTopButton, { passive: true });

loadQuotes();
loadAuthors();
updateBackToTopButton();
