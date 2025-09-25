#!/usr/bin/env node

/**
 * Script para atualizar todos os endpoints com autenticação padronizada
 * Executa as atualizações necessárias para garantir funcionamento perfeito
 */

const fs = require('fs');
const path = require('path');

// Template para endpoints simples
const simpleEndpointTemplate = (endpointName, functionName) => `import { NextRequest } from "next/server"
import { ${functionName} } from "../all-metrics-endpoints"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAccount()
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    const { searchParams } = request.nextUrl
    const period = searchParams.get('period') || '30days'
    
    return await ${functionName}(auth.mlAccount.mlUserId, period)
  } catch (error) {
    console.error('[${endpointName}] Error:', error)
    return NextResponse.json(
      { error: "Failed to fetch ${endpointName.toLowerCase()}" },
      { status: 500 }
    )
  }
}`;

// Endpoints para atualizar
const endpointsToUpdate = [
  {
    path: '/root/ml-agent/app/api/mercadolibre/reputation-metrics/route.ts',
    name: 'ReputationMetrics',
    function: 'getReputationMetrics',
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/sales-velocity/route.ts',
    name: 'SalesVelocity',
    function: 'getSalesVelocity',
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/response-time/route.ts',
    name: 'ResponseTime',
    function: 'getResponseTime',
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/financial-summary/route.ts',
    name: 'FinancialSummary',
    function: 'getFinancialSummary',
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/conversion-metrics/route.ts',
    name: 'ConversionMetrics',
    function: 'getConversionMetrics',
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/attendance-metrics/route.ts',
    name: 'AttendanceMetrics',
    function: 'getResponseTime', // Usa response time como attendance
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/highlights/route.ts',
    name: 'Highlights',
    function: 'getHighlights',
    needsPeriod: false
  },
  {
    path: '/root/ml-agent/app/api/mercadolibre/advanced-metrics/route.ts',
    name: 'AdvancedMetrics',
    function: 'getAdvancedMetrics',
    needsPeriod: true
  }
];

// Criar template específico para cada endpoint
endpointsToUpdate.forEach(endpoint => {
  let content;
  
  if (endpoint.needsPeriod) {
    content = simpleEndpointTemplate(endpoint.name, endpoint.function);
  } else {
    // Template sem period parameter
    content = `import { NextRequest } from "next/server"
import { ${endpoint.function} } from "../all-metrics-endpoints"
import { getAuthenticatedAccount } from "@/lib/api/session-auth"
import { NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAccount()
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    return await ${endpoint.function}(auth.mlAccount.mlUserId)
  } catch (error) {
    console.error('[${endpoint.name}] Error:', error)
    return NextResponse.json(
      { error: "Failed to fetch ${endpoint.name.toLowerCase().replace(/([A-Z])/g, ' $1').trim()}" },
      { status: 500 }
    )
  }
}`;
  }
  
  // Criar diretório se não existir
  const dir = path.dirname(endpoint.path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Escrever arquivo
  fs.writeFileSync(endpoint.path, content);
  console.log(`✅ Updated: ${endpoint.path}`);
});

console.log('\n🎉 All endpoints updated successfully!');
console.log('Next steps:');
console.log('1. Update all-metrics-endpoints.ts with missing functions');
console.log('2. Test each endpoint with proper authentication');
console.log('3. Monitor for rate limiting and adjust accordingly');