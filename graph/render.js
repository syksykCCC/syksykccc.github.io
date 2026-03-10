(function () {
  function escapeHtml(input) {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatInline(text) {
    let out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="note-image" src="$2" alt="$1" loading="lazy">');
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return out;
  }

  function closeLists(state, html) {
    while (state.listStack.length) {
      const tag = state.listStack.pop();
      html.push(`</${tag}>`);
    }
  }

  function resolveFoldType(rawType) {
    const normalized = (rawType || "").trim().toLowerCase();

    if (["remark", "note", "备注"].includes(normalized)) {
      return "remark";
    }

    if (["tip", "hint", "提示"].includes(normalized)) {
      return "tip";
    }

    if (["warn", "warning", "注意"].includes(normalized)) {
      return "warn";
    }

    if (["error", "danger", "错误"].includes(normalized)) {
      return "error";
    }

    return "";
  }

  function defaultFoldTitle(type) {
    if (type === "tip") {
      return "💡 提示";
    }

    if (type === "warn") {
      return "⚠️ 注意";
    }

    if (type === "error") {
      return "⛔ 错误";
    }

    return "📝 备注";
  }

  function parseMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    const state = {
      inCode: false,
      codeLang: "",
      codeLines: [],
      inQuote: false,
      quoteLines: [],
      listStack: []
    };

    const flushCode = () => {
      const langClass = state.codeLang ? ` class="lang-${escapeHtml(state.codeLang)}"` : "";
      const code = escapeHtml(state.codeLines.join("\n"));
      html.push(`<pre><code${langClass}>${code}</code></pre>`);
      state.inCode = false;
      state.codeLang = "";
      state.codeLines = [];
    };

    const flushQuote = () => {
      if (state.inQuote) {
        html.push(`<blockquote>${formatInline(state.quoteLines.join("<br>"))}</blockquote>`);
        state.inQuote = false;
        state.quoteLines = [];
      }
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (state.inCode) {
        if (line.startsWith("```")) {
          flushCode();
        } else {
          state.codeLines.push(line);
        }
        continue;
      }

      const codeStart = line.match(/^```\s*(\S*)\s*$/);
      if (codeStart) {
        flushQuote();
        closeLists(state, html);
        state.inCode = true;
        state.codeLang = codeStart[1] || "";
        continue;
      }

      const foldStart = line.match(/^\s*:::\s*([a-zA-Z\u4e00-\u9fa5]+)\s*(.*)$/);
      if (foldStart) {
        const foldType = resolveFoldType(foldStart[1]);

        if (!foldType) {
          closeLists(state, html);
          html.push(`<p>${formatInline(line.trim())}</p>`);
          continue;
        }

        flushQuote();
        closeLists(state, html);

        const summary = foldStart[2].trim() || defaultFoldTitle(foldType);
        const bodyLines = [];
        let foundEnd = false;

        for (let j = i + 1; j < lines.length; j += 1) {
          const inner = lines[j];
          if (/^\s*:::\s*$/.test(inner)) {
            i = j;
            foundEnd = true;
            break;
          }
          bodyLines.push(inner);
        }

        if (!foundEnd) {
          html.push(`<p>${formatInline(line.trim())}</p>`);
          if (bodyLines.length) {
            html.push(parseMarkdown(bodyLines.join("\n")));
          }
          break;
        }

        const bodyHtml = bodyLines.length ? parseMarkdown(bodyLines.join("\n").trim()) : "";
        html.push(`<details class="note-fold note-fold--${foldType}"><summary>${formatInline(summary)}</summary><div class="note-fold-body">${bodyHtml}</div></details>`);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushQuote();
        closeLists(state, html);
        const level = heading[1].length;
        html.push(`<h${level}>${formatInline(heading[2].trim())}</h${level}>`);
        continue;
      }

      if (/^\s*[-*_]{3,}\s*$/.test(line)) {
        flushQuote();
        closeLists(state, html);
        html.push("<hr>");
        continue;
      }

      const quoteLine = line.match(/^>\s?(.*)$/);
      if (quoteLine) {
        closeLists(state, html);
        state.inQuote = true;
        state.quoteLines.push(quoteLine[1]);
        continue;
      }

      flushQuote();

      const ul = line.match(/^\s*[-*+]\s+(.+)$/);
      const ol = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ul || ol) {
        const wanted = ul ? "ul" : "ol";
        const content = (ul || ol)[1];

        if (!state.listStack.length || state.listStack[state.listStack.length - 1] !== wanted) {
          closeLists(state, html);
          html.push(`<${wanted}>`);
          state.listStack.push(wanted);
        }

        html.push(`<li>${formatInline(content.trim())}</li>`);
        continue;
      }

      if (/^\s*$/.test(line)) {
        closeLists(state, html);
        continue;
      }

      closeLists(state, html);
      html.push(`<p>${formatInline(line.trim())}</p>`);
    }

    if (state.inCode) {
      flushCode();
    }
    flushQuote();
    closeLists(state, html);

    return html.join("\n");
  }

  window.OSNoteRenderer = {
    parseMarkdown
  };
})();
