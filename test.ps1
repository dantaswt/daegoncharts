try {
    $r = Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 120 -UseBasicParsing
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
