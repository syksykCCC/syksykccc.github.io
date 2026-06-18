(function () {
  const data = window.BEIXIGAI_DATA;
  const app = document.querySelector("#app");
  const cardMap = new Map(data.cards.map((card) => [card.id, card]));
  const sectionMap = new Map(data.sections.map((section) => [section.id, section]));
  const subsectionMap = new Map(
    data.sections.flatMap((section) =>
      section.subsections.map((subsection) => [subsection.id, { ...subsection, parent: section }]),
    ),
  );

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderInline(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "")
      .replace(/\t/g, "    ")
      .replace(/\r\n/g, "\n")
      .split("\n");
    let html = "";
    let paragraph = [];
    const stack = [];

    function closeParagraph() {
      if (!paragraph.length) return;
      html += `<p>${renderInline(paragraph.join(" "))}</p>`;
      paragraph = [];
    }

    function closeListItem() {
      const top = stack.at(-1);
      if (top && top.itemOpen) {
        html += "</li>";
        top.itemOpen = false;
      }
    }

    function closeList() {
      closeListItem();
      const top = stack.pop();
      html += `</${top.type}>`;
    }

    function closeListsTo(indent) {
      while (stack.length && stack.at(-1).indent > indent) {
        closeList();
      }
    }

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      if (!line.trim()) {
        closeParagraph();
        while (stack.length) closeList();
        continue;
      }

      const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (!match) {
        if (stack.length) {
          html += `<p>${renderInline(line.trim())}</p>`;
        } else {
          paragraph.push(line.trim());
        }
        continue;
      }

      closeParagraph();
      const indent = match[1].length;
      const type = /\d/.test(match[2]) ? "ol" : "ul";

      closeListsTo(indent);

      if (!stack.length || stack.at(-1).indent < indent || stack.at(-1).type !== type) {
        html += `<${type}>`;
        stack.push({ indent, type, itemOpen: false });
      } else {
        closeListItem();
      }

      html += `<li>${renderInline(match[3].trim())}`;
      stack.at(-1).itemOpen = true;
    }

    closeParagraph();
    while (stack.length) closeList();
    return `<div class="markdown-body">${html}</div>`;
  }

  function countCardsForSection(section) {
    if (section.cards.length) return section.cards.length;
    return section.subsections.reduce((sum, subsection) => sum + subsection.cards.length, 0);
  }

  function cardHref(cardId) {
    return `#/card/${encodeURIComponent(cardId)}`;
  }

  function sectionHref(section) {
    return section.subsections.length ? `#/section/${section.id}` : `#/cards/${section.id}`;
  }

  function subsectionHref(subsection) {
    return `#/cards/${subsection.id}`;
  }

  function breadcrumb(items) {
    const body = items
      .map((item, index) => {
        const text = escapeHtml(item.label);
        if (!item.href || index === items.length - 1) return `<span>${text}</span>`;
        return `<a href="${item.href}">${text}</a>`;
      })
      .join("<span>/</span>");
    return `<nav class="breadcrumb" aria-label="面包屑">${body}</nav>`;
  }

  function pageHead(title, items, note = "") {
    return `
      <header class="page-head">
        ${breadcrumb(items)}
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${note ? `<p class="muted">${escapeHtml(note)}</p>` : ""}
      </header>
    `;
  }

  function renderHome() {
    const sectionItems = data.sections
      .map((section) => {
        const count = countCardsForSection(section);
        return `
          <li>
            <a class="directory-link" href="${sectionHref(section)}">
              <span class="link-title">${escapeHtml(section.title)}</span>
              <span class="link-meta">${count ? `${count} 张卡片` : "暂无卡片"}</span>
            </a>
          </li>
        `;
      })
      .join("");

    app.innerHTML = `
      <section class="hero-panel">
        <div>
          <p class="eyebrow">随机抽题</p>
          <h1>背习概</h1>
          <p class="source-note">本网站所有题目直接取自思政课资源共享群习概61页资料，感谢资料整理者</p>
          <p class="hero-copy">从 ${data.cards.length} 张卡片中等概率抽取一题，先看问题，想清楚后再显示答案和助记提示。</p>
        </div>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-random>开始抽题</button>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <h2>知识点目录</h2>
          <p class="muted">${data.sections.length} 个大标题</p>
        </div>
        <ul class="directory-list">${sectionItems}</ul>
      </section>
    `;
  }

  function renderSection(sectionId) {
    const section = sectionMap.get(sectionId);
    if (!section) return renderNotFound();

    if (!section.subsections.length) {
      return renderCardList(section.id);
    }

    const rows = section.subsections
      .map((subsection) => `
        <li>
          <a class="directory-link" href="${subsectionHref(subsection)}">
            <span class="link-title">${escapeHtml(subsection.title)}</span>
            <span class="link-meta">${subsection.cards.length ? `${subsection.cards.length} 张卡片` : "暂无卡片"}</span>
          </a>
        </li>
      `)
      .join("");

    app.innerHTML = `
      ${pageHead(section.title, [
        { label: "首页", href: "#/" },
        { label: section.title },
      ])}
      <section class="section-block">
        <div class="section-heading">
          <h2>小标题</h2>
          <p class="muted">${section.subsections.length} 个小标题</p>
        </div>
        <ul class="directory-list">${rows || emptyState("暂无小标题")}</ul>
      </section>
    `;
  }

  function renderCardList(ownerId) {
    const section = sectionMap.get(ownerId);
    const subsection = subsectionMap.get(ownerId);
    const cards = section ? section.cards : subsection ? subsection.cards : [];
    const title = section ? section.title : subsection ? subsection.title : "卡片列表";
    const parent = subsection ? subsection.parent : null;
    const trail = section
      ? [{ label: "首页", href: "#/" }, { label: section.title }]
      : [
          { label: "首页", href: "#/" },
          { label: parent.title, href: `#/section/${parent.id}` },
          { label: title },
        ];

    const rows = cards
      .map((cardId) => {
        const card = cardMap.get(cardId);
        return `
          <li>
            <a class="question-link" href="${cardHref(card.id)}">
              <span class="link-title">${escapeHtml(card.question)}</span>
              <span class="link-meta">${escapeHtml(card.id)}</span>
            </a>
          </li>
        `;
      })
      .join("");

    app.innerHTML = `
      ${pageHead(title, trail, cards.length ? `${cards.length} 张卡片` : "暂无卡片")}
      <section class="section-block">
        <ul class="question-list">${rows || emptyState("这里还没有 card 文件。")}</ul>
      </section>
    `;
  }

  function renderCard(cardId) {
    const card = cardMap.get(cardId);
    if (!card) return renderNotFound();
    const section = sectionMap.get(card.sectionId);
    const subsection = card.subsectionId ? subsectionMap.get(card.subsectionId) : null;
    const trail = [
      { label: "首页", href: "#/" },
      { label: section.title, href: sectionHref(section) },
    ];
    if (subsection) trail.push({ label: subsection.title, href: subsectionHref(subsection) });
    trail.push({ label: card.id });

    app.innerHTML = `
      ${pageHead(card.question, trail)}
      <article class="card-detail">
        <section class="content-panel question-panel">
          <h2 class="answer-title">Question</h2>
          ${renderMarkdown(card.question)}
        </section>
        <section class="content-panel">
          <h2 class="answer-title">Answer</h2>
          ${renderMarkdown(card.answer)}
        </section>
        <section class="content-panel tip-panel">
          <h2 class="tip-title">Tip</h2>
          ${renderMarkdown(card.tip)}
        </section>
      </article>
    `;
  }

  function renderRandom(cardId) {
    const card = cardMap.get(cardId);
    if (!card) return pickRandomCard();
    app.innerHTML = `
      ${pageHead("随机抽题", [
        { label: "首页", href: "#/" },
        { label: "随机抽题" },
      ])}
      <article class="random-panel">
        <section class="content-panel question-panel">
          <h2 class="answer-title">Question</h2>
          ${renderMarkdown(card.question)}
        </section>
        <div class="actions-row">
          <button class="primary-button" type="button" data-show-answer>显示答案</button>
        </div>
        <section class="content-panel fade-in" data-answer hidden>
          <h2 class="answer-title">Answer</h2>
          ${renderMarkdown(card.answer)}
        </section>
        <section class="content-panel tip-panel fade-in" data-answer hidden>
          <h2 class="tip-title">Tip</h2>
          ${renderMarkdown(card.tip)}
        </section>
      </article>
    `;
  }

  function emptyState(message) {
    return `<li class="empty-state">${escapeHtml(message)}</li>`;
  }

  function renderNotFound() {
    app.innerHTML = `
      ${pageHead("没有找到这个页面", [{ label: "首页", href: "#/" }, { label: "未找到" }])}
      <p class="empty-state">请从首页目录重新进入。</p>
    `;
  }

  function pickRandomCard() {
    if (!data.cards.length) {
      app.innerHTML = `<p class="empty-state">还没有可抽取的 card。</p>`;
      return;
    }
    const index = Math.floor(Math.random() * data.cards.length);
    const card = data.cards[index];
    window.location.hash = `#/random/${encodeURIComponent(card.id)}`;
  }

  function route() {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    const [, view, rawId] = hash.split("/");
    const id = rawId ? decodeURIComponent(rawId) : "";

    if (hash === "/" || view === "") renderHome();
    else if (view === "section") renderSection(id);
    else if (view === "cards") renderCardList(id);
    else if (view === "card") renderCard(id);
    else if (view === "random") id ? renderRandom(id) : pickRandomCard();
    else renderNotFound();

    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  document.addEventListener("click", (event) => {
    const randomButton = event.target.closest("[data-random]");
    if (randomButton) {
      pickRandomCard();
      return;
    }

    const answerButton = event.target.closest("[data-show-answer]");
    if (answerButton) {
      document.querySelectorAll("[data-answer]").forEach((element) => {
        element.hidden = false;
      });
      answerButton.hidden = true;
    }
  });

  window.addEventListener("hashchange", route);
  route();
})();
