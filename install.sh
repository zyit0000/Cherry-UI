#!/bin/bash

# Configuration
URL="https://github.com/zyit0000/Cherry-UI/releases/download/V1.0.0/CherryUniversal.dmg"
DMG_FILE="CherryUniversal.dmg"

echo "Downloading CherryUniversal..."
curl -L -o "$DMG_FILE" "$URL"

if [ $? -ne 0 ]; then
    echo "Download failed!"
    exit 1
fi

echo "Mounting DMG..."
# Mount the DMG and grab the mount point path
MOUNT_DIR=$(hdiutil mount "$DMG_FILE" | tail -1 | awk -F'\t' '{print $NF}')

if [ -z "$MOUNT_DIR" ]; then
    echo "Failed to mount DMG!"
    exit 1
fi

echo "Installing to /Applications..."
# Copy the .app file from the DMG to the Applications folder
cp -R "$MOUNT_DIR"/*.app /Applications/

echo "Cleaning up..."
# Unmount and delete the temporary DMG file
hdiutil unmount "$MOUNT_DIR"
rm "$DMG_FILE"

echo "Done! Cherry Universal is now in your Applications folder."
