#!/bin/bash

echo "Fixing Next.js Image warnings..."

# Add Image import to files that need it
files=(
  "components/agent/ml-accounts-podium.tsx"
  "components/agent/question-card.tsx"
  "components/dashboard/ml-agent-dashboard.tsx"
  "components/payment-modal.tsx"
)

for file in "${files[@]}"; do
  if ! grep -q "import Image from" "$file"; then
    # Add Image import after the first import line
    sed -i '0,/^import/s/^import/import Image from "next\/image"\nimport/' "$file"
    echo "Added Image import to $file"
  fi
done

echo "All image imports added successfully!"