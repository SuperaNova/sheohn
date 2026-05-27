#!/bin/bash

# Exit immediately if any command fails
set -e

echo "Running Pre-Commit Checks..."

echo "1. Formatting code..."
npm run format

echo "2. Linting code..."
npm run lint

echo "3. Type checking..."
npm run check

echo "4. Running unit tests..."
npx vitest run

echo "5. Running E2E tests..."
npm run test:e2e

echo "All checks passed! Ready to commit."
