const fs = require('fs');
const path = require('path');

const files = [
  'apps/api/src/app/api/articles/route.ts',
  'apps/api/src/app/api/articles/[id]/route.ts',
  'apps/api/src/app/api/practice-management/areas/route.ts',
  'apps/api/src/app/api/practice-management/areas/[id]/route.ts',
  'apps/api/src/app/api/practice-management/areas/[id]/subareas/route.ts',
  'apps/api/src/app/api/practice-management/areas/[id]/subareas/[subareaId]/route.ts',
  'apps/api/src/app/api/practice-management/clients/route.ts',
  'apps/api/src/app/api/practice-management/clients/[id]/route.ts',
  'apps/api/src/app/api/practice-management/compras/route.ts',
  'apps/api/src/app/api/practice-management/compras/[id]/route.ts',
  'apps/api/src/app/api/practice-management/cotizaciones/route.ts',
  'apps/api/src/app/api/practice-management/cotizaciones/[id]/route.ts',
  'apps/api/src/app/api/practice-management/ledger/balance/route.ts',
  'apps/api/src/app/api/practice-management/ledger/route.ts',
  'apps/api/src/app/api/practice-management/ledger/[id]/attachments/route.ts',
  'apps/api/src/app/api/practice-management/ledger/[id]/facturas/route.ts',
  'apps/api/src/app/api/practice-management/ledger/[id]/facturas-xml/route.ts',
  'apps/api/src/app/api/practice-management/ledger/[id]/route.ts',
  'apps/api/src/app/api/practice-management/product-attributes/route.ts',
  'apps/api/src/app/api/practice-management/product-attributes/[id]/route.ts',
  'apps/api/src/app/api/practice-management/product-attributes/[id]/values/route.ts',
  'apps/api/src/app/api/practice-management/product-attributes/[id]/values/[valueId]/route.ts',
  'apps/api/src/app/api/practice-management/products/route.ts',
  'apps/api/src/app/api/practice-management/products/[id]/components/route.ts',
  'apps/api/src/app/api/practice-management/products/[id]/components/[componentId]/route.ts',
  'apps/api/src/app/api/practice-management/products/[id]/route.ts',
  'apps/api/src/app/api/practice-management/proveedores/route.ts',
  'apps/api/src/app/api/practice-management/proveedores/[id]/route.ts',
  'apps/api/src/app/api/practice-management/ventas/from-quotation/[id]/route.ts',
  'apps/api/src/app/api/practice-management/ventas/route.ts',
  'apps/api/src/app/api/practice-management/ventas/[id]/route.ts',
];

const results = [];

files.forEach(file => {
  const fullPath = path.join('C:/Users/52331/docs-front', file);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  // Find all getAuthenticatedDoctor calls
  const doctorDeclarations = [];
  lines.forEach((line, index) => {
    if (line.includes('getAuthenticatedDoctor')) {
      doctorDeclarations.push({
        line: index + 1,
        text: line.trim()
      });
    }
  });
  
  if (doctorDeclarations.length === 0) return;
  
  // For each declaration, find doctor property accesses
  const unsafeAccesses = [];
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    // Look for direct doctor property access (doctor.xxx)
    if (/\bdoctor\.\w+/.test(line)) {
      // Check if this line or nearby lines have null checks
      const hasNullCheck = checkForNullCheck(lines, index);
      
      if (!hasNullCheck) {
        unsafeAccesses.push({
          line: lineNum,
          text: line.trim()
        });
      }
    }
  });
  
  if (unsafeAccesses.length > 0) {
    results.push({
      file,
      fullPath,
      declarations: doctorDeclarations,
      unsafeAccesses
    });
  }
});

function checkForNullCheck(lines, currentIndex) {
  // Check the previous 10 lines for null checks
  const startIndex = Math.max(0, currentIndex - 10);
  const checkLines = lines.slice(startIndex, currentIndex + 1);
  
  for (const line of checkLines) {
    // Look for common null check patterns
    if (
      /if\s*\(\s*!doctor\s*\)/.test(line) ||
      /if\s*\(\s*doctor\s*===\s*null\s*\)/.test(line) ||
      /if\s*\(\s*doctor\s*==\s*null\s*\)/.test(line) ||
      /if\s*\(\s*!\s*doctor\s*\)/.test(line) ||
      /doctor\?\./.test(line) // optional chaining
    ) {
      return true;
    }
  }
  return false;
}

console.log(JSON.stringify(results, null, 2));
