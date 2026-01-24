param($filePath)
$encoded = [uri]::EscapeDataString($filePath)
Start-Process "http://localhost:3000/?file=$encoded"
