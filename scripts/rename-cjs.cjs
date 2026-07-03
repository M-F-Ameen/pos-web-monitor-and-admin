const fs = require("fs");
const path = require("path");
const dist = path.join(__dirname, "..", "electron-dist");
function rename(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { rename(p); continue; }
    if (!f.endsWith(".js")) continue;
    const cjs = p.slice(0, -3) + ".cjs";
    fs.renameSync(p, cjs);
  }
}
rename(dist);
