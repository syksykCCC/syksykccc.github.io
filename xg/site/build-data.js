const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outputFile = path.join(__dirname, "data.js");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function naturalCompare(a, b) {
  const left = a.match(/\d+|\D+/g) || [];
  const right = b.match(/\d+|\D+/g) || [];
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const x = left[index] || "";
    const y = right[index] || "";
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny) && nx !== ny) return nx - ny;
    const compared = x.localeCompare(y, "zh-CN");
    if (compared !== 0) return compared;
  }
  return 0;
}

function listDirectories(dir, pattern) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort(naturalCompare);
}

function listCards(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^card.*\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort(naturalCompare);
}

function parseCard(filePath) {
  const source = readText(filePath).replace(/\r\n/g, "\n");
  const match = source.match(/^Question:\s*(.*?)\n+Answer:\s*\n?([\s\S]*?)\n+Tip:\s*([\s\S]*)$/);
  if (!match) {
    throw new Error(`Card format is invalid: ${path.relative(rootDir, filePath)}`);
  }
  return {
    question: match[1].trim(),
    answer: match[2].trim(),
    tip: match[3].trim(),
  };
}

const cards = [];

function addCards(dir, sectionId, subsectionId) {
  return listCards(dir).map((fileName) => {
    const filePath = path.join(dir, fileName);
    const id = path.basename(fileName, ".md");
    const card = {
      id,
      sectionId,
      subsectionId,
      file: path.relative(rootDir, filePath).replaceAll(path.sep, "/"),
      ...parseCard(filePath),
    };
    cards.push(card);
    return id;
  });
}

const sections = listDirectories(rootDir, /^sec\d+$/).map((sectionId) => {
  const sectionDir = path.join(rootDir, sectionId);
  const titleFile = path.join(sectionDir, "title.md");
  const section = {
    id: sectionId,
    title: exists(titleFile) ? readText(titleFile) : sectionId,
    cards: [],
    subsections: [],
  };

  const subsectionIds = listDirectories(sectionDir, /^sec\d+\.\d+$/);
  if (subsectionIds.length) {
    section.subsections = subsectionIds.map((subsectionId) => {
      const subsectionDir = path.join(sectionDir, subsectionId);
      const subsectionTitleFile = path.join(subsectionDir, "title.md");
      return {
        id: subsectionId,
        title: exists(subsectionTitleFile) ? readText(subsectionTitleFile) : subsectionId,
        cards: addCards(subsectionDir, sectionId, subsectionId),
      };
    });
  } else {
    section.cards = addCards(sectionDir, sectionId, null);
  }

  return section;
});

const payload = {
  generatedAt: new Date().toISOString(),
  sections,
  cards,
};

fs.writeFileSync(
  outputFile,
  `window.BEIXIGAI_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8",
);

console.log(`Generated ${path.relative(rootDir, outputFile)} with ${sections.length} sections and ${cards.length} cards.`);
