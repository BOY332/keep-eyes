const fs = require("node:fs");
const path = require("node:path");

const electronZip = path.join(__dirname, "build", "electron", "electron-v43.4.1-win32-x64.zip");

// Keep using a local Electron zip when present; otherwise let CI download it.
module.exports = fs.existsSync(electronZip) ? { electronDist: electronZip } : {};
