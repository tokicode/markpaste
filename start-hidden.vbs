Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\wshi\markdown-renderer"
objShell.Run "node server.js", 0, False
