#!/bin/bash
set -e

# ─── Configuration ─────────────────────────────────────────────────────────
REPO="zyit0000/Cherry-ui"
TAG="v1.0.0"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# ─── Architecture detection ────────────────────────────────────────────────
ARCH=$(uname -m)

if [ "$ARCH" = "arm64" ]; then
  DMG_FILE="CherryArm.dmg"
  ARCH_LABEL="Apple Silicon (ARM)"
elif [ "$ARCH" = "x86_64" ]; then
  DMG_FILE="CherryIntel.dmg"
  ARCH_LABEL="Intel"
else
  echo "Unknown architecture: $ARCH. Falling back to Universal build."
  DMG_FILE="CherryUniversal.dmg"
  ARCH_LABEL="Universal"
fi

DOWNLOAD_URL="${BASE_URL}/${DMG_FILE}"

echo "──────────────────────────────────────────"
echo "   Cherry Installer"
echo "──────────────────────────────────────────"
echo "Detected architecture : $ARCH ($ARCH_LABEL)"
echo "Downloading           : $DMG_FILE"
echo "From                  : $DOWNLOAD_URL"
echo ""

# ─── Download ──────────────────────────────────────────────────────────────
curl -L --progress-bar -o "/tmp/${DMG_FILE}" "$DOWNLOAD_URL"

if [ $? -ne 0 ]; then
  echo "Download failed!"
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

# ─── Install ───────────────────────────────────────────────────────────────
echo "Installing Cherry to /Applications..."
cp -R "$MOUNT_DIR"/*.app /Applications/

# ─── Cleanup ───────────────────────────────────────────────────────────────
echo "Cleaning up..."
hdiutil detach "$MOUNT_DIR" -quiet
rm "/tmp/${DMG_FILE}"

echo ""
echo "──────────────────────────────────────────"
echo "   Done! Cherry is now in /Applications."
echo "──────────────────────────────────────────"
