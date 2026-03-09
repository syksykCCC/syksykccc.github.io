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
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return out;
  }

  function closeLists(state, html) {
    while (state.listStack.length) {
      const tag = state.listStack.pop();
      html.push(`</${tag}>`);
    }
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
