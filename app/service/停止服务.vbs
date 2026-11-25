' ============================================================
' 控制探秘营 · 停止后台服务
' 先写停止标记（守护进程不再重启），再结束占用 8830 的进程。
' ============================================================
Option Explicit

Dim fso, sh, svcDir, stopFlag, killed, seen, pids, i, f, quiet

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

quiet = WScript.Arguments.Named.Exists("quiet")
svcDir = fso.GetParentFolderName(WScript.ScriptFullName)
stopFlag = svcDir & "\STOP.flag"

Set f = fso.CreateTextFile(stopFlag, True)
f.WriteLine Now
f.Close

killed = 0
seen = ","

pids = PidsListening(8830)
For i = 0 To UBound(pids)
  If pids(i) <> "" Then
    If InStr(seen, "," & pids(i) & ",") = 0 Then
      seen = seen & pids(i) & ","
      killed = killed + KillPid(pids(i))
    End If
  End If
Next

Dim wmi, procs, p
On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
If Err.Number = 0 Then
  Set procs = wmi.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='node.exe'")
  For Each p In procs
    If InStr(1, p.CommandLine & "", "server\index.cjs", 1) > 0 Then
      If InStr(seen, "," & p.ProcessId & ",") = 0 Then
        seen = seen & p.ProcessId & ","
        killed = killed + KillPid(CStr(p.ProcessId))
      End If
    End If
  Next
End If
On Error GoTo 0

WScript.Sleep 4000

If fso.FileExists(stopFlag) Then
  On Error Resume Next
  fso.DeleteFile stopFlag, True
  On Error GoTo 0
End If

If Not quiet Then
  MsgBox "控制探秘营服务已停止。" & vbCrLf & vbCrLf & _
         "结束进程数：" & killed & vbCrLf & vbCrLf & _
         "重新启动：双击桌面「控制探秘营-启动服务」", _
         vbInformation, "控制探秘营"
End If

WScript.Quit 0

' ------------------------------------------------------------
Function PidsListening(port)
  Dim exec, out, lines, i, pos, pid, acc
  acc = ""
  On Error Resume Next
  Set exec = sh.Exec("netstat -ano")
  If Err.Number = 0 Then
    out = exec.StdOut.ReadAll
    lines = Split(out, vbCrLf)
    For i = 0 To UBound(lines)
      If InStr(lines(i), ":" & CStr(port) & " ") > 0 And InStr(UCase(lines(i)), "LISTENING") > 0 Then
        pos = InStrRev(lines(i), " ")
        pid = Trim(Mid(lines(i), pos + 1))
        If pid <> "" And IsNumeric(pid) Then
          If InStr("," & acc & ",", "," & pid & ",") = 0 Then
            If acc = "" Then
              acc = pid
            Else
              acc = acc & "," & pid
            End If
          End If
        End If
      End If
    Next
  End If
  On Error GoTo 0
  If acc = "" Then
    PidsListening = Array()
  Else
    PidsListening = Split(acc, ",")
  End If
End Function

Function KillPid(pid)
  Dim rc
  KillPid = 0
  If pid = "" Then Exit Function
  On Error Resume Next
  rc = sh.Run("taskkill /F /PID " & pid, 0, True)
  If Err.Number = 0 And rc = 0 Then KillPid = 1
  On Error GoTo 0
End Function
