// BuilderCompanyNames.js
import fs from "fs";
import path from "path";

const SOURCES = [
  "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
  "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
];

function guessDomain(name) {
  return (
    name
      .toLowerCase()
      .replace(/,|\.|inc|corp|corporation|ltd|plc|group|holdings/gi, "")
      .trim()
      .split(" ")[0] + ".com"
  );
}

async function run() {
  const map = {};

  for (const url of SOURCES) {
    const res = await fetch(url); // ✅ fetch nativo
    const txt = await res.text();
    const lines = txt.split("\n");

    for (const line of lines) {
      if (!line || line.startsWith("Symbol")) continue;

      const [symbol, name] = line.split("|");
      if (!symbol || !name) continue;

      map[symbol] = guessDomain(name);
    }
  }

  // ✅ ESCRIBE EN LA MISMA CARPETA DONDE ESTÁ EL SCRIPT
  const outputPath = path.resolve(
    process.cwd(),
    "companyDomains.js"
  );

  fs.writeFileSync(
    outputPath,
    `export const COMPANY_DOMAINS = ${JSON.stringify(map, null, 2)};`
  );

  console.log("✅ companyDomains.js generado:", outputPath);
}

run();
