' ============================================================
' 控制探秘营 · 后台守护启动
' 隐藏窗口运行 node 服务；进程异常退出 3 秒后自动重启；
' 收到「停止服务」指令后退出。
' 可直接双击，也可由开机任务 / 桌面快捷方式调用。
' ============================================================
Option Explicit

Dim fso, sh, svcDir, appDir, nodeExe, logFile, stopFlag, rc, quiet

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

quiet = WScript.Arguments.Named.Exists("quiet")

svcDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.GetParentFolderName(svcDir)
logFile = appDir & "\data\service.log"
stopFlag = svcDir & "\STOP.flag"

If Not fso.FolderExists(appDir & "\data") Then fso.CreateFolder appDir & "\data"

nodeExe = "C:\Users\Administrator\AppData\Local\Programs\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
  nodeExe = "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
End If
If Not fso.FileExists(nodeExe) Then nodeExe = "node.exe"

sh.CurrentDirectory = appDir

If IsListening(8830) Then
  WriteLog "端口 8830 已在监听，守护进程退出（避免重复启动）。"
  WScript.Quit 0
End If

If fso.FileExists(stopFlag) Then fso.DeleteFile stopFlag, True

WriteLog "守护启动：node=" & nodeExe & "，目录=" & appDir

Do
  If fso.FileExists(stopFlag) Then
    On Error Resume Next
    fso.DeleteFile stopFlag, True
    On Error GoTo 0
    WriteLog "收到停止指令，守护退出。"
    Exit Do
  End If

  WriteLog "拉起服务：node --no-warnings server\index.cjs"
  rc = sh.Run("""" & nodeExe & """ --no-warnings server\index.cjs", 0, True)
  WriteLog "服务进程退出，exitCode=" & rc

  If Not fso.FileExists(stopFlag) Then
    WriteLog "3 秒后自动重启"
    WScript.Sleep 3000
  End If
Loop

' ------------------------------------------------------------
Function IsListening(port)
  Dim exec, out, lines, i
  IsListening = False
  On Error Resume Next
  Set exec = sh.Exec("netstat -ano")
  If Err.Number <> 0 Then Exit Function
  out = exec.StdOut.ReadAll
  If Err.Number <> 0 Then Exit Function
  lines = Split(out, vbCrLf)
  For i = 0 To UBound(lines)
    If InStr(lines(i), ":" & CStr(port) & " ") > 0 And InStr(UCase(lines(i)), "LISTENING") > 0 Then
      IsListening = True
      Exit Function
    End If
  Next
  On Error GoTo 0
End Function

Sub WriteLog(msg)
  Dim f
  On Error Resume Next
  Set f = fso.OpenTextFile(logFile, 8, True, -1)
  If Err.Number = 0 Then
    f.WriteLine Now & "  " & msg
    f.Close
  End If
  On Error GoTo 0
End Sub
