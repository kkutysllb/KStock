; NSIS 安装前钩子：终止残留的 gateway 进程，避免 DLL 占用导致复制失败。
; 对齐原 src-tauri/nsis-hooks.nsh 的 NSIS_HOOK_PREINSTALL 语义。

!macro NSIS_HOOK_PREINSTALL
  ; kstock-gateway.exe 是 PyInstaller onedir 主程序，运行时持有大量 DLL 句柄。
  ; 安装器复制文件前必须先终止它，否则 "Error opening file for writing"。
  nsExec::ExecToLog 'taskkill /IM kstock-gateway.exe /F /T'
  Pop $0
!macroend
