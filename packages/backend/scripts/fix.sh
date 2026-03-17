#!/bin/bash

clear

echo "Running prettify, lint check and fix, ts check. Please wait..."

npm run format

npm run lint

echo ''
echo 'Checking frontend types...'

(cd ../frontend && npx tsc --noEmit)

echo 'Finished, prettified, no lint or ts errors found. You can close this window.'