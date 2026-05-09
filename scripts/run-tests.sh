#!/bin/bash
cd "$CLAUDE_PROJECT_DIR"

input=$(cat)
stop_active=$(echo "$input" | jq -r '.stop_hook_active // false')
if [ "$stop_active" = "true" ]; then
  exit 0
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null 2>&1

output=$(npx vitest run --reporter=dot 2>&1)
exit_code=$?

if [ $exit_code -ne 0 ]; then
  jq -n --arg out "$output" '{
    decision: "block",
    reason: ("Les tests échouent. Corrige les erreurs avant de terminer :\n\n" + $out)
  }'
  exit 0
fi

exit 0
