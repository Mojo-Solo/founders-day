#!/bin/bash

# Backup script for Founders Day monorepo consolidation
# Run this from the founders-day directory

BACKUP_NAME="founders-day-backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$HOME/Desktop/$BACKUP_NAME"

echo "Creating backup at: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy important files and directories (excluding large/generated files)
echo "Copying founders-day-frontend..."
rsync -av --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.turbo' \
  --exclude='coverage' \
  founders-day-frontend/ "$BACKUP_DIR/founders-day-frontend/"

echo "Copying founders-day-admin..."
rsync -av --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.turbo' \
  --exclude='coverage' \
  founders-day-admin/ "$BACKUP_DIR/founders-day-admin/"

echo "Copying shared-types..."
cp -r shared-types "$BACKUP_DIR/"

echo "Copying workspace files..."
cp pnpm-workspace.yaml "$BACKUP_DIR/" 2>/dev/null || true
cp package.json "$BACKUP_DIR/" 2>/dev/null || true
cp pnpm-lock.yaml "$BACKUP_DIR/" 2>/dev/null || true

# Also backup git info
echo "Saving git remote info..."
echo "Frontend remote:" > "$BACKUP_DIR/git-remotes.txt"
cd founders-day-frontend && git remote -v >> "$BACKUP_DIR/git-remotes.txt"
echo -e "\nAdmin remote:" >> "$BACKUP_DIR/git-remotes.txt"
cd ../founders-day-admin && git remote -v >> "$BACKUP_DIR/git-remotes.txt"
cd ..

# Create a compressed archive
echo "Creating compressed archive..."
cd "$HOME/Desktop"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME/"

echo "✅ Backup complete!"
echo "📁 Backup directory: $BACKUP_DIR"
echo "📦 Backup archive: $HOME/Desktop/$BACKUP_NAME.tar.gz"
echo ""
echo "You now have both:"
echo "1. An uncompressed backup folder for easy access"
echo "2. A compressed .tar.gz file for archival"