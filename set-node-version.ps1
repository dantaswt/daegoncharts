$headers = @{'Authorization'='Bearer nfp_j2PmJyDKLoTkyuGfhSDtfBYTP48T4r5h6a7c';'Content-Type'='application/json'}
$body = '{"build_settings":{"environment":{"NODE_VERSION":"20"}}}'
$result = Invoke-RestMethod -Uri 'https://api.netlify.com/api/v1/sites/29a4b923-94c5-4805-b20c-f930d0818548' -Method PATCH -Headers $headers -Body $body
Write-Output "NODE_VERSION: $($result.build_settings.environment.NODE_VERSION)"
