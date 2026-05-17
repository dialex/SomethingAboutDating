// Minimal markdown subset for step.description content.
// Supports: paragraphs, blank-line breaks, `- ` bullet lists, **bold**, *italic*.
// Input is HTML-escaped first so user content cannot inject markup.

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderInline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function renderMarkdown(src) {
  const lines = escapeHtml(src).split("\n");
  const out = [];
  let list = null;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${renderInline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<ul>${list.join("")}</ul>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      list ??= [];
      list.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("");
}
