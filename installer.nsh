!macro customInit
  ; Close running instance of IQON PC Monitor before installing
  nsExec::ExecToLog "taskkill /f /im IQON PC Monitor.exe"
  nsExec::ExecToLog 'taskkill /f /im "IQON PC Monitor.exe"'
  Sleep 1000
!macroend
