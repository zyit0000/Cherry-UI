#!/bin/bash
clear
set -e

# ─── Configuration ─────────────────────────────────────────────────────────
REPO="zyit0000/Cherry-ui"
TAG="v1.0.0"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
USER_APPS="$HOME/Applications"

# ─── Architecture detection ────────────────────────────────────────────────
ARCH=$(uname -m)

if [ "$ARCH" = "arm64" ]; then
  DMG_FILE="CherryArm.dmg"
  ARCH_LABEL="Apple Silicon (ARM)"
elif [ "$ARCH" = "x86_64" ]; then
  DMG_FILE="CherryIntel.dmg"
  ARCH_LABEL="Intel"
else
  DMG_FILE="CherryUniversal.dmg"
  ARCH_LABEL="Universal (fallback)"
fi

DOWNLOAD_URL="${BASE_URL}/${DMG_FILE}"

echo "──────────────────────────────────────────"
echo "   Cherry Installer  (User)"
echo "   Installs to: ~/Applications"
echo "   Requires:    No sudo / No admin"
echo "──────────────────────────────────────────"
echo "Detected architecture : $ARCH ($ARCH_LABEL)"
echo "Downloading           : $DMG_FILE"
echo ""

# ─── Ensure ~/Applications exists ─────────────────────────────────────────
mkdir -p "$USER_APPS"

# ─── Download ──────────────────────────────────────────────────────────────
HTTP_STATUS=$(curl -L --progress-bar -w "%{http_code}" -o "/tmp/${DMG_FILE}" "$DOWNLOAD_URL")

if [ "$HTTP_STATUS" != "200" ]; then
  echo ""
  echo "Error: Download failed (HTTP $HTTP_STATUS)."
  echo "       The release may not have been published yet."
  echo "       Check: https://github.com/${REPO}/releases"
  rm -f "/tmp/${DMG_FILE}"
  exit 1
fi

# Verify the downloaded file is not an HTML error page
FILE_TYPE=$(file -b "/tmp/${DMG_FILE}")
if echo "$FILE_TYPE" | grep -qi "html\|ascii text\|utf-8 unicode text"; then
  echo ""
  echo "Error: Download returned an HTML error page instead of a DMG."
  echo "       The release may not be published yet or the asset is missing."
  echo "       Check: https://github.com/${REPO}/releases"
  rm -f "/tmp/${DMG_FILE}"
  exit 1
fi

# ─── Mount ─────────────────────────────────────────────────────────────────
echo ""
echo "Mounting DMG..."
MOUNT_DIR=$(hdiutil attach "/tmp/${DMG_FILE}" -nobrowse -noautoopen | tail -1 | awk -F'\t' '{print $NF}')

if [ -z "$MOUNT_DIR" ]; then
  echo "Failed to mount DMG!"
  exit 1
fi

# ─── Remove old Cherry install (clean upgrade) ────────────────────────────
echo "Removing old Cherry.app (if any)..."
rm -rf "$USER_APPS/Cherry.app"

# ─── Install to ~/Applications (no sudo needed) ───────────────────────────
echo "Installing Cherry to ~/Applications..."
cp -R "$MOUNT_DIR"/*.app "$USER_APPS/"

# ─── Cleanup ───────────────────────────────────────────────────────────────
echo "Cleaning up..."
hdiutil detach "$MOUNT_DIR" -quiet
rm "/tmp/${DMG_FILE}"

echo ""
echo "──────────────────────────────────────────"
echo "   Done! Cherry is now in ~/Applications."
echo "   You can also drag it to /Applications"
echo "   anytime if you want a system install."
echo "──────────────────────────────────────────"
