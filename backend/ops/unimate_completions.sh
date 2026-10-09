_unimate_completions() {
  local current_word previous_word

  # COMP_WORDS contains what has been typed; COMP_CWORD is the word being completed.
  current_word="${COMP_WORDS[COMP_CWORD]}"
  previous_word="${COMP_WORDS[COMP_CWORD-1]}"
  COMPREPLY=()

  # Complete the command name: "unimate <TAB>".
  if [[ "$COMP_CWORD" -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "start stop status logs update list grant revoke seed backup help" -- "$current_word") )

  # Complete the service name: "unimate logs <TAB>".
  elif [[ "$COMP_CWORD" -eq 2 && "$previous_word" == "logs" ]]; then
    COMPREPLY=( $(compgen -W "backend db" -- "$current_word") )
  fi
}

# Register this function as the Bash completion handler for the unimate command.
complete -F _unimate_completions unimate