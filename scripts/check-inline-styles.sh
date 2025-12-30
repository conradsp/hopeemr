#!/bin/bash

# Quick script to find and show all remaining inline styles
# Run from examples/emr directory

echo "=== Remaining Inline Styles ==="
echo ""

grep -r "style={{" src --include="*.tsx" | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  count=$(grep -c "style={{" "$file")
  echo "$file: $count inline styles"
done | sort | uniq

echo ""
echo "=== Total Count ==="
grep -r "style={{" src --include="*.tsx" | wc -l

echo ""
echo "=== Files with Inline Styles ==="
grep -r "style={{" src --include="*.tsx" -l | wc -l

