; NSIS 安装前钩子：终止残留的引擎进程，避免文件占用导致复制失败。
; 对齐原 src-tauri/nsis-hooks.nsh 的 NSIS_HOOK_PREINSTALL 语义。

!macro NSIS_HOOK_PREINSTALL
  ; kstock-engine.exe 是引擎单文件可执行（pkg/SEA），运行时持有自身文件句柄；
  ; 安装器复制文件前必须先终止它，否则 "Error opening file for writing"。
  nsExec::ExecToLog 'taskkill /IM kstock-engine.exe /F /T'
  Pop $0
  ; 1.x 旧版的 kstock-gateway.exe（PyInstaller uvicorn）同样常驻 18001 端口、
  ; 持有旧安装目录文件句柄；升级安装时必须一并终止，否则新引擎起不来
  ; （2.0 壳会探测端口归属并报「端口被占用」）。
  nsExec::ExecToLog 'taskkill /IM kstock-gateway.exe /F /T'
  Pop $0
!macroend
