' Starts the MarkPaste server without leaving a console window open.
' EDIT THE PATH BELOW to point at your own copy of this repository.
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\PATH\TO\MarkPaste"
objShell.Run "node server.js", 0, False
