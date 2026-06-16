#!/bin/bash
# auto-patch.sh — 在 AI 对话功能实现后自动同步改动到 Patch 文件
#
# 使用方式:
#   ./scripts/auto-patch.sh [topic]
#   AUTO_PATCH_TOPIC="fix-bug" ./scripts/auto-patch.sh
#   npx opencode run --skill auto-patch
#
# 环境变量:
#   AUTO_PATCH_TOPIC    - Patch 主题描述（用于文件名）
#   AUTO_PATCH_DIR      - 输出目录（默认: repo-root/session-patches）
#   AUTO_PATCH_MAX_FILES - 最大文件数（默认: 50）

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PATCH_DIR="${AUTO_PATCH_DIR:-${REPO_ROOT}/session-patches}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
MAX_FILES="${AUTO_PATCH_MAX_FILES:-50}"

# 1. 检查是否有变更
if git diff --quiet HEAD && git diff --cached --quiet HEAD; then
  echo "🟢 没有检测到变更，跳过 Patch 生成"
  exit 0
fi

# 2. 构建文件名
SESSION_TOPIC="${1:-${AUTO_PATCH_TOPIC:-session}}"
SAFE_TOPIC=$(echo "$SESSION_TOPIC" | sed 's/[^a-zA-Z0-9_-]/_/g' | cut -c1-50)
PATCH_FILE="${PATCH_DIR}/${TIMESTAMP}-${SAFE_TOPIC}.patch"

mkdir -p "$PATCH_DIR"

# 3. 检查变更文件数
CHANGED_COUNT=$(git diff --name-only HEAD | wc -l)
if [ "$CHANGED_COUNT" -gt "$MAX_FILES" ]; then
  echo "⚠️  变更文件数 ${CHANGED_COUNT} 超过限制 ${MAX_FILES}，生成部分 Patch"
  # 只生成前 N 个文件
  git diff HEAD -- $(git diff --name-only HEAD | head -n "$MAX_FILES") > "$PATCH_FILE"
else
  # 生成完整 Patch
  git diff HEAD > "$PATCH_FILE"
fi

# 4. 追加元数据
{
  echo ""
  echo "# --- Patch Metadata ---"
  echo "# Generated: $(date -Iseconds)"
  echo "# Session: ${SESSION_TOPIC}"
  echo "# Changed files: ${CHANGED_COUNT}"
  echo "# Files:"
  git diff --name-only HEAD | sed 's/^/#   /'
} >> "$PATCH_FILE"

echo "📝 Patch 已生成: ${PATCH_FILE}"
echo "   变更文件数: ${CHANGED_COUNT}"
echo "   大小: $(du -h "$PATCH_FILE" | cut -f1)"
