const fs = require('fs');
const path = 'D:\\Antigravity\\resources\\app\\extensions\\antigravity\\dist\\extension.js';

try {
  const content = fs.readFileSync(path, 'utf8');

  // Find all typeName definitions
  const typeNames = content.match(/typeName:"[^"]+"/g) || [];
  console.log('--- All TypeNames ---');
  [...new Set(typeNames)].slice(0, 50).forEach(t => console.log(t));

  // Find NodeService specifically
  const nodeServiceIdx = content.indexOf('NodeService');
  if (nodeServiceIdx !== -1) {
    const context = content.substring(Math.max(0, nodeServiceIdx - 100), Math.min(content.length, nodeServiceIdx + 500));
    console.log('\n--- NodeService Context ---');
    console.log(context);
  }

} catch (err) {
  console.error('Error:', err);
}
