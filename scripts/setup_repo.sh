#!/usr/bin/env bash
set -euo pipefail

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm install --lts
  nvm use --lts
else
  echo "nvm not found. Install Node.js LTS before continuing."
  exit 1
fi

npm install
npx playwright install

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python 3 to use gallery scripts."
  exit 0
fi

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install exifread

echo "Setup complete."
