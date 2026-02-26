/**
 * Shell 自动补全脚本模板
 * 提供 Bash 和 Zsh 的补全脚本生成函数
 */

/**
 * 获取 Bash 自动补全脚本内容
 * @returns {string} Bash 脚本字符串
 */
export function getBashScript(): string {
  return `
_clawt_completion() {
  local IFS=$'\\n'
  local completions=$(clawt completion _complete bash "$COMP_CWORD" "\${COMP_WORDS[@]}")
  COMPREPLY=()
  local comp
  while IFS= read -r comp; do
    [ -z "$comp" ] && continue
    COMPREPLY+=("$comp")
  done <<< "$completions"
  local has_dir=0
  for comp in "\${COMPREPLY[@]}"; do
    [[ "$comp" == */ ]] && has_dir=1 && break
  done
  if (( has_dir )) && type compopt &>/dev/null; then
    compopt -o nospace
  fi
}
complete -o nospace -F _clawt_completion clawt
`;
}

/**
 * 获取 Zsh 自动补全脚本内容
 * @returns {string} Zsh 脚本字符串
 */
export function getZshScript(): string {
  return `
#compdef clawt
_clawt_completion() {
  local completions
  local cword=$((CURRENT - 1))
  completions=("\${(@f)$(clawt completion _complete zsh "$cword" "\${words[@]}")}")
  if [[ -n "$completions" ]]; then
    local comp
    for comp in "\${completions[@]}"; do
      [[ -z "$comp" ]] && continue
      if [[ "$comp" == */ ]]; then
        compadd -S '' -- "$comp"
      else
        compadd -S ' ' -- "$comp"
      fi
    done
  fi
}
compdef _clawt_completion clawt
`;
}
