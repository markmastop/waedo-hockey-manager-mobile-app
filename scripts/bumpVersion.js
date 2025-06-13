const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const appPath = path.join(__dirname, '..', 'app.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

function bump(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3) return version;
  parts[2] += 1; // bump patch
  return parts.join('.');
}

const current = app.expo.version || pkg.version;
const next = bump(current);

pkg.version = next;
if (!app.expo) app.expo = {};
app.expo.version = next;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

console.log(`Version bumped from ${current} to ${next}`);

