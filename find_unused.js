const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const frontendFiles = walk('c:/WMT-GROUP-16-main/mobile-app/src').filter(f => f.endsWith('.js') || f.endsWith('.jsx'));
let frontendContent = '';
frontendFiles.forEach(f => {
  frontendContent += fs.readFileSync(f, 'utf8') + '\n';
});

const backendDir = 'c:/WMT-GROUP-16-main/backend/routes';
const backendFiles = fs.readdirSync(backendDir).filter(f => f.endsWith('.js'));
const unusedRoutes = [];

backendFiles.forEach(f => {
  const content = fs.readFileSync(path.join(backendDir, f), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const match = line.match(/router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/);
    if (match) {
      const endpoint = match[2];
      const method = match[1];
      // simplistic heuristic: check if endpoint exists in frontend code
      // We look for parts of the URL or the full URL.
      // Often frontend uses api.get('/path/to/resource')
      let found = false;
      const strippedEndpoint = endpoint.replace(/:[a-zA-Z0-9_]+/g, '');
      const parts = strippedEndpoint.split('/').filter(p => p.length > 0);
      
      if (parts.length > 0) {
        // Find if frontend calls anything similar
        const keyword = parts[parts.length - 1];
        if (frontendContent.includes(keyword)) {
          found = true;
        }
      } else {
        found = true; // '/' route
      }
      
      if (!found) {
        unusedRoutes.push({ file: f, method, endpoint, line: index + 1 });
      }
    }
  });
});

console.log(JSON.stringify(unusedRoutes, null, 2));
