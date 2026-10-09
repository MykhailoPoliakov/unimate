#!/usr/bin/env bash

# Find this folder, even when the installer is sourced from another directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASH_RC="$HOME/.bashrc"
MARKER="# unimate command"

# Add the command and its completions to Bash's startup file only once.
if ! grep -Fq "$MARKER" "$BASH_RC" 2>/dev/null; then
  {
    printf '\n%s\n' "$MARKER"
    printf 'export PATH="%s:$PATH"\n' "$SCRIPT_DIR"
    printf 'source "%s/unimate_completions.sh"\n' "$SCRIPT_DIR"
  } >> "$BASH_RC"
  echo "Added unimate to $BASH_RC for future Bash terminals."
fi

# Update this terminal now; the .bashrc lines above are for future terminals.
chmod +x "$SCRIPT_DIR/unimate"
export PATH="$SCRIPT_DIR:$PATH"
source "$SCRIPT_DIR/unimate_completions.sh"
echo "unimate is ready in this terminal."