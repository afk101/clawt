#!/usr/bin/env bash
# ============================================================
# release.sh - Clawt 自动发布脚本
# 功能: 构建 → 交互式选择版本级别 → 更新 package.json → 提交 → 打 tag → push → pnpm publish
# 用法: bash scripts/release.sh
# ============================================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # 恢复默认

# ────────────────────────────────────────
# 工具函数
# ────────────────────────────────────────

# 输出成功信息
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# 输出错误信息并退出
print_error() {
  echo -e "${RED}✗ $1${NC}" >&2
  exit 1
}

# 输出警告信息
print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# 输出步骤信息
print_step() {
  echo -e "${CYAN}→ $1${NC}"
}

# ────────────────────────────────────────
# 预检
# ────────────────────────────────────────

# 确保在项目根目录（有 package.json）
if [ ! -f "package.json" ]; then
  print_error "请在项目根目录下执行此脚本"
fi

# 确保工作区干净
if [ -n "$(git status --porcelain)" ]; then
  print_error "工作区有未提交的更改，请先提交或暂存"
fi

# 确保在主分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  print_warning "当前分支为 ${CURRENT_BRANCH}，不是 main/master"
  read -rp "是否继续发布？(y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消发布"
    exit 0
  fi
fi

# ────────────────────────────────────────
# 读取当前版本
# ────────────────────────────────────────

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo ""
echo -e "${BOLD}当前版本: v${CURRENT_VERSION}${NC}"
echo ""

# ────────────────────────────────────────
# 解析版本号
# ────────────────────────────────────────

# 将 semver 拆分为 major / minor / patch / prerelease
IFS='.' read -r MAJOR MINOR PATCH_FULL <<< "$CURRENT_VERSION"

# 分离 patch 和 prerelease（如 1.0.32-0 → patch=32, prerelease=0）
if [[ "$PATCH_FULL" == *-* ]]; then
  PATCH="${PATCH_FULL%%-*}"
  PRERELEASE="${PATCH_FULL#*-}"
else
  PATCH="$PATCH_FULL"
  PRERELEASE=""
fi

# ────────────────────────────────────────
# 计算各级别的目标版本
# ────────────────────────────────────────

NEXT_PATCH="$MAJOR.$MINOR.$((PATCH + 1))"
NEXT_MINOR="$MAJOR.$((MINOR + 1)).0"
NEXT_MAJOR="$((MAJOR + 1)).0.0"

if [ -n "$PRERELEASE" ]; then
  NEXT_PRERELEASE="$MAJOR.$MINOR.$PATCH-$((PRERELEASE + 1))"
else
  NEXT_PRERELEASE="$MAJOR.$MINOR.$PATCH-0"
fi

# ────────────────────────────────────────
# 交互式选择版本级别
# ────────────────────────────────────────

echo -e "${BOLD}选择版本升级级别:${NC}"
echo ""
echo -e "  ${CYAN}1)${NC} patch      ${CURRENT_VERSION} → ${GREEN}${NEXT_PATCH}${NC}       Bug 修复、小改动"
echo -e "  ${CYAN}2)${NC} minor      ${CURRENT_VERSION} → ${GREEN}${NEXT_MINOR}${NC}       新增功能、向后兼容"
echo -e "  ${CYAN}3)${NC} major      ${CURRENT_VERSION} → ${GREEN}${NEXT_MAJOR}${NC}       破坏性变更"
echo -e "  ${CYAN}4)${NC} prerelease ${CURRENT_VERSION} → ${GREEN}${NEXT_PRERELEASE}${NC}  预发布/测试版本"
echo ""
read -rp "请选择 [1-4] (默认: 1): " CHOICE
CHOICE=${CHOICE:-1}

case "$CHOICE" in
  1) NEW_VERSION="$NEXT_PATCH" ;;
  2) NEW_VERSION="$NEXT_MINOR" ;;
  3) NEW_VERSION="$NEXT_MAJOR" ;;
  4) NEW_VERSION="$NEXT_PRERELEASE" ;;
  *) print_error "无效的选择: $CHOICE" ;;
esac

echo ""
echo -e "${BOLD}即将发布: v${CURRENT_VERSION} → v${NEW_VERSION}${NC}"
read -rp "确认发布？(y/N) " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "已取消发布"
  exit 0
fi

echo ""

TAG="v${NEW_VERSION}"

# 回滚函数：pnpm publish 失败时撤销 commit、tag、push
# 参数 $1: 是否已推送到远程（"pushed" 表示已推送）
rollback() {
  local pushed="${1:-}"
  echo ""
  print_warning "正在回滚版本变更..."

  # 回滚远程推送（仅在已推送时执行）
  if [ "$pushed" = "pushed" ]; then
    git push origin --delete "$TAG" 2>/dev/null && print_step "已删除远程 tag: ${TAG}" || print_warning "删除远程 tag 失败，请手动执行: git push origin --delete ${TAG}"
    git push origin HEAD~1:refs/heads/"$(git branch --show-current)" --force-with-lease 2>/dev/null && print_step "已回退远程 commit" || print_warning "回退远程 commit 失败，请手动处理"
  fi

  # 回滚本地 tag
  git tag -d "$TAG" 2>/dev/null && print_step "已删除本地 tag: ${TAG}" || true

  # 回滚本地 commit（回退到上一个 commit，保留文件改动后再还原）
  git reset --hard HEAD~1 2>/dev/null && print_step "已回退本地 commit" || print_warning "回退本地 commit 失败，请手动处理"

  echo ""
  print_error "发布失败，所有变更已回滚"
}

# ────────────────────────────────────────
# 步骤 1: 构建
# ────────────────────────────────────────

print_step "构建项目..."
pnpm build
print_success "构建完成"

# ────────────────────────────────────────
# 步骤 2: 更新 package.json 版本号
# ────────────────────────────────────────

print_step "更新版本号: ${CURRENT_VERSION} → ${NEW_VERSION}"
# 使用 pnpm version 更新版本号，--no-git-tag-version 避免自动打 tag
pnpm version "$NEW_VERSION" --no-git-tag-version > /dev/null
print_success "版本号已更新"

# ────────────────────────────────────────
# 步骤 3: 提交版本变更
# ────────────────────────────────────────

print_step "提交版本变更..."
git add package.json pnpm-lock.yaml 2>/dev/null || git add package.json
git commit -m "build: bump version to ${NEW_VERSION}"
print_success "版本变更已提交"

# ────────────────────────────────────────
# 步骤 4: 创建 git tag
# ────────────────────────────────────────

print_step "创建 tag: ${TAG}"
git tag "$TAG"
print_success "tag 已创建: ${TAG}"

# ────────────────────────────────────────
# 步骤 5: 发布到 npm（先发布，成功后再推送 git）
# 调整顺序：pnpm publish 放在 git push 之前
# 如果 publish 失败，只需回滚本地 commit 和 tag，无需处理远程
# ────────────────────────────────────────

print_step "发布到 npm..."
# npm 开启 2FA 时需要 OTP，交互式获取
read -rp "请输入 npm 2FA 验证码（OTP，可留空跳过）: " NPM_OTP
PUBLISH_CMD="npm publish --access public --registry https://registry.npmjs.org/"
if [ -n "$NPM_OTP" ]; then
  PUBLISH_CMD="$PUBLISH_CMD --otp $NPM_OTP"
fi
# 临时关闭 set -e，手动捕获 npm publish 的退出码
set +e
NPM_OUTPUT=$($PUBLISH_CMD 2>&1)
NPM_EXIT_CODE=$?
set -e

if [ $NPM_EXIT_CODE -ne 0 ]; then
  echo ""
  print_warning "npm publish 输出:"
  echo "$NPM_OUTPUT"
  echo ""
  rollback "not_pushed"
fi
print_success "已发布到 npm"

# ────────────────────────────────────────
# 步骤 6: 推送 commit 和 tag 到远程仓库
# npm 发布成功后才推送，确保 git 和 npm 状态一致
# ────────────────────────────────────────

print_step "推送 commit 和 tag 到远程仓库..."
set +e
git push 2>&1
PUSH_EXIT_CODE=$?
set -e

if [ $PUSH_EXIT_CODE -ne 0 ]; then
  print_warning "git push 失败，但 npm 已发布 v${NEW_VERSION}"
  print_warning "请手动执行: git push && git push origin ${TAG}"
  exit 1
fi

set +e
git push origin "$TAG" 2>&1
TAG_PUSH_EXIT_CODE=$?
set -e

if [ $TAG_PUSH_EXIT_CODE -ne 0 ]; then
  print_warning "tag 推送失败，但 npm 已发布 v${NEW_VERSION}，commit 已推送"
  print_warning "请手动执行: git push origin ${TAG}"
  exit 1
fi

print_success "已推送到远程仓库"

# ────────────────────────────────────────
# 完成
# ────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  发布完成! v${NEW_VERSION}${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  npm: https://www.npmjs.com/package/clawt"
echo -e "  tag: ${TAG}"
echo ""
