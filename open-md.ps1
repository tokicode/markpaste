param($filePath)
$encoded = [uri]::EscapeDataString($filePath)
Start-Process "http://127.0.0.1:3000/?file=$encoded"
