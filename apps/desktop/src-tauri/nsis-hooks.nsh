; Release the bundled gateway before NSIS replaces resources.
; Windows keeps loaded DLLs locked, so an upgrade can otherwise fail while
; copying gateway/_internal/MSVCP140.dll.
!macro NSIS_HOOK_PREINSTALL
  ExecWait '"$SYSDIR\taskkill.exe" /F /T /IM kstock-gateway.exe'
!macroend
