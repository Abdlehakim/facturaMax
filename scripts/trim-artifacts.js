const fs = require("fs");
const path = require("path");

exports.default = async (context) => {
  const outDir = context.outDir;
  for (const name of fs.readdirSync(outDir)) {
    if (name.endsWith(".blockmap") || name === "latest.yml") {
      try { fs.unlinkSync(path.join(outDir, name)); } catch {}
    }
  }
  return [];
};
