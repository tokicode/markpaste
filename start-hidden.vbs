Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\youid\markdown-renderer"
objShell.Run "node server.js", 0, False
