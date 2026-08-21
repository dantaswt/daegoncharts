$headers = @{'Authorization'='Bearer nfp_j2PmJyDKLoTkyuGfhSDtfBYTP48T4r5h6a7c'}
$deploys = Invoke-RestMethod -Uri 'https://api.netlify.com/api/v1/sites/29a4b923-94c5-4805-b20c-f930d0818548/deploys?per_page=1' -Headers $headers
$deploy = $deploys[0]
Write-Output "Deploy ID: $($deploy.id)"
Write-Output "State: $($deploy.state)"
Write-Output "Error: $($deploy.error_message)"
foreach ($fn in $deploy.available_functions) {
    Write-Output "Function: $($fn.n) | Runtime: $($fn.r) | Generator: $($fn.g) | Size: $($fn.s)"
}
