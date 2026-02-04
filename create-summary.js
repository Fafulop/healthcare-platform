const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/52331/docs-front/doctor-null-check-analysis.json', 'utf-8'));

console.log('FILE PATH,UNSAFE ACCESSES COUNT,LINE NUMBERS');
data.forEach(item => {
  const lineNumbers = item.unsafeAccesses.map(a => a.line).join('; ');
  console.log(`"${item.file}",${item.unsafeAccesses.length},"${lineNumbers}"`);
});

const totalAccesses = data.reduce((sum, item) => sum + item.unsafeAccesses.length, 0);
console.log('');
console.log(`TOTAL FILES: ${data.length}`);
console.log(`TOTAL UNSAFE ACCESSES: ${totalAccesses}`);
