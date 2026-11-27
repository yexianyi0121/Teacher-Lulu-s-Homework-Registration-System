#!/bin/bash
# 学情登记管理系统 · macOS 数据排查 / 备份 / 恢复
# 适用：Safari（以及 Mac 上的 Chrome / Edge）
# 用法：放到「学情登记系统.html」同一个文件夹，双击运行；
#       若双击没反应，在「终端」里执行：bash "$(dirname "$0")/学情数据恢复.command"

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_ROOT="$HOME/XueQingBackup"

APP_HTML=""
for f in "$SCRIPT_DIR"/*.html; do
  [ -f "$f" ] || continue
  case "$(basename "$f")" in
    index.html) ;;
    *) APP_HTML="$f"; break ;;
  esac
done
[ -z "$APP_HTML" ] && APP_HTML="$SCRIPT_DIR/index.html"

say() { printf '%s\n' "$*"; }
line() { printf '%s\n' "------------------------------------------------------------"; }

# 所有可能存放学情数据的目录
candidate_dirs() {
  printf '%s\n' \
    "$HOME/Library/Safari/LocalStorage" \
    "$HOME/Library/Safari/Databases" \
    "$HOME/Library/Containers/com.apple.Safari/Data/Library/Safari/LocalStorage" \
    "$HOME/Library/Containers/com.apple.Safari/Data/Library/Safari/Databases"
  for base in "$HOME/Library/Application Support/Google/Chrome" "$HOME/Library/Application Support/Microsoft Edge"; do
    [ -d "$base" ] || continue
    find "$base" -maxdepth 3 -type d \( -name "Local Storage" -o -name "IndexedDB" \) -print 2>/dev/null
  done
}

scan_stores() {
  local dir f hit=0
  while IFS= read -r dir; do
    [ -d "$dir" ] || continue
    while IFS= read -r -d '' f; do
      if grep -aq "xq.state.v4" "$f" 2>/dev/null; then
        hit=$((hit + 1))
        say "  [$hit] $f"
        say "      修改时间：$(date -r "$f" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)   大小：$(du -h "$f" 2>/dev/null | cut -f1)"
      fi
    done < <(find "$dir" -maxdepth 4 -type f \( -name "*.localstorage" -o -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" -o -name "*.ldb" -o -name "*.log" \) -print0 2>/dev/null)
  done < <(candidate_dirs)
  if [ "$hit" -eq 0 ]; then
    say "  没有找到任何含 xq.state.v4 的数据文件。"
    say "  说明：这台 Mac 的当前用户目录下，Safari/Chrome/Edge 都没有学情数据。"
  fi
}

backup_all() {
  local ts dest manifest dir rel n=0
  ts="$(date +%Y%m%d-%H%M%S)"
  dest="$BACKUP_ROOT/$ts"
  mkdir -p "$dest" || { say "无法创建备份目录：$dest"; return; }
  manifest="$dest/manifest.txt"
  : > "$manifest"
  while IFS= read -r dir; do
    [ -d "$dir" ] || continue
    rel="$(printf '%s' "$dir" | sed "s|$HOME|HOME|g" | tr '/' '_')"
    if cp -R "$dir" "$dest/$rel" 2>/dev/null; then
      printf '%s|%s\n' "$dir" "$rel" >> "$manifest"
      n=$((n + 1))
    fi
  done < <(candidate_dirs)
  if [ "$n" -eq 0 ]; then
    say "没有可备份的数据目录。"
    rmdir "$dest" 2>/dev/null
    return
  fi
  say "已备份 $n 个目录到：$dest"
  say "备份清单：$manifest"
}

list_backups() {
  [ -d "$BACKUP_ROOT" ] || return 1
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort -r
}

restore_backup() {
  local dirs sel dest manifest src rel ts
  dirs="$(list_backups)"
  if [ -z "$dirs" ]; then
    say "还没有自动备份。"
    return
  fi
  say "可用备份（新的在最上面）："
  local i=0 arr=()
  while IFS= read -r d; do
    i=$((i + 1)); arr+=("$d")
    say "  [$i] $(basename "$d")"
  done <<< "$dirs"
  printf '选择要恢复的编号（回车取消）：'
  read -r sel
  [ -z "${sel:-}" ] && return
  case "$sel" in (*[!0-9]*|'') say "编号无效"; return;; esac
  if [ "$sel" -lt 1 ] || [ "$sel" -gt "${#arr[@]}" ]; then say "编号无效"; return; fi
  dest="${arr[$((sel - 1))]}"
  manifest="$dest/manifest.txt"
  [ -f "$manifest" ] || { say "备份缺少清单，无法恢复。"; return; }

  osascript -e 'quit app "Safari"' >/dev/null 2>&1
  sleep 2
  if pgrep -x Safari >/dev/null 2>&1; then
    say "Safari 还在运行，请先完全退出 Safari（⌘Q）后再试。"
    return
  fi

  ts="$(date +%Y%m%d-%H%M%S)"
  while IFS='|' read -r src rel; do
    [ -n "$src" ] || continue
    if [ -d "$src" ]; then
      mv "$src" "$src.before-restore-$ts" 2>/dev/null
    fi
    mkdir -p "$(dirname "$src")"
    cp -R "$dest/$rel" "$src" 2>/dev/null
    say "已恢复：$src"
  done < "$manifest"
  say "恢复完成。请重新打开「学情登记系统.html」，并立刻导出备份。"
}

open_app() {
  if [ -f "$APP_HTML" ]; then
    open -a Safari "$APP_HTML"
    say "已用 Safari 打开：$APP_HTML"
  else
    say "没有在脚本同目录找到 html 文件，请把脚本放到 dist 文件夹里再运行。"
  fi
}

while true; do
  line
  say "学情登记管理系统 · macOS 数据排查/备份/恢复"
  say "  1) 扫描：列出本机含学情数据的文件"
  say "  2) 立即备份 Safari / Chrome / Edge 的学情数据"
  say "  3) 从备份恢复（会先退出 Safari）"
  say "  4) 用 Safari 打开系统"
  say "  0) 退出"
  line
  printf '请选择：'
  read -r choice
  case "${choice:-}" in
    1) scan_stores ;;
    2) backup_all ;;
    3) restore_backup ;;
    4) open_app ;;
    0|'') exit 0 ;;
    *) say "无效选择" ;;
  esac
done