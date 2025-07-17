#!/bin/bash

# Setup script for Obsidian Message Sync Plugin Development

set -e

echo "🚀 Setting up Obsidian Message Sync Plugin Development Environment"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it first:"
    echo "npm install -g pnpm"
    exit 1
fi

# Install dependencies
print_info "Installing dependencies..."
pnpm install

# Build the plugin for development
print_info "Building plugin for development..."
pnpm run build:plugin:dev

# Check if dist directory exists
if [ ! -d "dist" ]; then
    print_error "Build failed - dist directory not found"
    exit 1
fi

# Copy styles.css to dist
print_info "Copying styles.css to dist..."
cp styles.css dist/

print_status "Plugin built successfully!"

# Display instructions
echo ""
echo "📋 Development Setup Instructions:"
echo "=================================="
echo ""
echo "1. 🔗 Create a symlink to your Obsidian plugins directory:"
echo "   For macOS/Linux:"
echo "   ln -s $(pwd)/dist ~/.obsidian/plugins/obsidian-message-sync-dev"
echo ""
echo "   For Windows:"
echo "   mklink /D \"%USERPROFILE%\\.obsidian\\plugins\\obsidian-message-sync-dev\" \"$(pwd)\\dist\""
echo ""
echo "2. 📁 Or manually copy the files to your Obsidian plugins directory:"
echo "   cp -r dist/* ~/.obsidian/plugins/obsidian-message-sync-dev/"
echo ""
echo "3. 🔄 Refresh plugins in Obsidian:"
echo "   - Open Obsidian Settings"
echo "   - Go to Community Plugins"
echo "   - Click 'Refresh' button"
echo "   - Enable 'Message Sync (Dev)'"
echo ""
echo "4. 👀 For continuous development:"
echo "   pnpm run build:plugin:watch"
echo ""
echo "5. 🚀 For production build:"
echo "   pnpm run build:plugin:prod"
echo ""

print_info "Development environment setup complete!"
print_warning "Remember to refresh plugins in Obsidian after each build!"

# Ask if user wants to start watch mode
echo ""
read -p "Would you like to start watch mode now? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting watch mode..."
    pnpm run build:plugin:watch
fi
