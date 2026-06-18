#!/bin/bash
# Android Patch Management Script
# Usage: ./apply-patches.sh [check|apply|create]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PATCHES_DIR="${SCRIPT_DIR}/patches"

check_patches() {
    echo "🔍 Checking patch files..."
    if [ ! -d "$PATCHES_DIR" ]; then
        echo "❌ Patches directory not found: $PATCHES_DIR"
        exit 1
    fi
    
    local patch_count=0
    for patch in "$PATCHES_DIR"/*.patch; do
        if [ -f "$patch" ]; then
            ((patch_count++))
            echo "  ✓ $(basename "$patch")"
        fi
    done
    
    if [ $patch_count -eq 0 ]; then
        echo "⚠️  No patch files found in $PATCHES_DIR"
        exit 1
    fi
    
    echo "📦 Found $patch_count patch file(s)"
}

apply_patches() {
    echo "🚀 Applying Android patches..."
    cd "$PROJECT_ROOT"
    
    local applied=0
    local failed=0
    
    for patch in "$PATCHES_DIR"/*.patch; do
        if [ -f "$patch" ]; then
            local patch_name=$(basename "$patch")
            echo "  📋 Applying $patch_name..."
            
            if git apply --check "$patch" 2>/dev/null; then
                if git apply "$patch"; then
                    echo "    ✅ Applied successfully"
                    ((applied++))
                else
                    echo "    ❌ Failed to apply"
                    ((failed++))
                fi
            else
                echo "    ⚠️  Patch already applied or conflicts detected"
                echo "    💡 Try: git apply --3way $patch"
                ((failed++))
            fi
        fi
    done
    
    echo ""
    echo "📊 Results: $applied applied, $failed failed"
    
    if [ $failed -gt 0 ]; then
        echo ""
        echo "🔧 Manual resolution needed for failed patches"
        echo "   Run: git status"
        echo "   Then resolve conflicts and commit"
    fi
}

create_patches() {
    echo "📝 Creating patch files from current changes..."
    cd "$PROJECT_ROOT"
    
    mkdir -p "$PATCHES_DIR"
    
    # Patch 1: Shared Android support in app/
    echo "  📋 Creating 001-shared-android-support.patch..."
    git diff HEAD~5 -- \
        app/vite.js \
        app/src/components/titlebar.tsx \
        app/src/pages/layout.tsx \
        app/src/pages/session/message-timeline.tsx \
        app/src/app.tsx \
        app/src/_android_entry.tsx \
        app/src/_resolve_proxy.ts \
        > "$PATCHES_DIR/001-shared-android-support.patch" 2>/dev/null || echo "    ⚠️  Some files may not have changes"
    
    # Patch 2: Android-specific files (new files, no conflict risk)
    echo "  📋 Creating 002-android-specific.patch..."
    git diff HEAD~5 -- \
        android/src/entry.tsx \
        android/src/platform.ts \
        android/src/styles/mobile.css \
        android/package.json \
        > "$PATCHES_DIR/002-android-specific.patch" 2>/dev/null || echo "    ⚠️  Some files may not have changes"
    
    # Patch 3: Native Android code
    echo "  📋 Creating 003-native-android.patch..."
    git diff HEAD~5 -- \
        android/android/app/src/main/java/ai/opencode/app/MainActivity.java \
        > "$PATCHES_DIR/003-native-android.patch" 2>/dev/null || echo "    ⚠️  Some files may not have changes"
    
    echo ""
    echo "✅ Patch files created in $PATCHES_DIR"
    ls -la "$PATCHES_DIR"/*.patch 2>/dev/null || echo "No patches created"
}

show_help() {
    cat << EOF
Android Patch Management Script

Usage: $0 [command]

Commands:
    check   - Check if patch files exist and are valid
    apply   - Apply all patch files to the current codebase
    create  - Create patch files from current git changes
    help    - Show this help message

Workflow:
    1. After upstream sync, run: $0 apply
    2. If patches fail, resolve conflicts manually
    3. To update patches after making changes: $0 create

Patch Files:
    001-shared-android-support.patch - Changes to shared app/ files
    002-android-specific.patch         - Android-only source files
    003-native-android.patch           - Native Android Java code
EOF
}

case "${1:-help}" in
    check)
        check_patches
        ;;
    apply)
        check_patches
        apply_patches
        ;;
    create)
        create_patches
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
