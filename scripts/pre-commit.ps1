$ErrorActionPreference = "Stop"

Write-Host "Running Pre-Commit Checks..." -ForegroundColor Cyan

Write-Host "`n1. Formatting code..." -ForegroundColor Yellow
npm run format

Write-Host "`n2. Linting code..." -ForegroundColor Yellow
npm run lint

Write-Host "`n3. Type checking..." -ForegroundColor Yellow
npm run check

Write-Host "`n4. Running unit tests..." -ForegroundColor Yellow
npx vitest run

Write-Host "`n5. Running E2E tests..." -ForegroundColor Yellow
npm run test:e2e

Write-Host "`nAll checks passed! Ready to commit." -ForegroundColor Green
