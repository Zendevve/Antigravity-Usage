import * as fs from 'fs';
import * as path from 'path';

const localePath = path.join(__dirname, '../src/i18n/locales/en.json');
const outPath = path.join(__dirname, '../src/i18n/keys.ts');

const data = JSON.parse(fs.readFileSync(localePath, 'utf8'));

function extractKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(extractKeys(obj[key], newPrefix));
    } else {
      keys.push(newPrefix);
    }
  }
  return keys;
}

const allKeys = extractKeys(data);
const typeDef = `// Auto-generated. Do not edit.\nexport type I18nKey =\n  | ` + allKeys.map(k => `'${k}'`).join('\n  | ') + `;\n`;

fs.writeFileSync(outPath, typeDef);
console.log('Successfully generated i18n keys type.');
