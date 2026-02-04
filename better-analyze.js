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
  
  // Find all getAuthenticatedDoctor call lines (not imports)
  const doctorCallLines = [];
  lines.forEach((line, index) => {
    if (line.includes('getAuthenticatedDoctor(') && line.includes('await')) {
      doctorCallLines.push(index);
    }
  });
  
  if (doctorCallLines.length === 0) return;
  
  // For each call, check if there's a null check in the next 15 lines
  const callsWithoutNullCheck = [];
  
  doctorCallLines.forEach(callLine => {
    const endLine = Math.min(callLine + 15, lines.length);
    const checkLines = lines.slice(callLine + 1, endLine);
    
    const hasNullCheck = checkLines.some(line => 
      /if\s*\(\s*!doctor\s*\)/.test(line) ||
      /if\s*\(\s*doctor\s*===\s*null\s*\)/.test(line)
    );
    
    if (!hasNullCheck) {
      callsWithoutNullCheck.push({
        callLine: callLine + 1,
        callText: lines[callLine].trim()
      });
    }
  });
  
  if (callsWithoutNullCheck.length > 0) {
    results.push({
      file,
      fullPath,
      callsWithoutNullCheck
    });
  }
});

console.log(JSON.stringify(results, null, 2));
