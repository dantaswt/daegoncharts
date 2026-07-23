$itunes = Invoke-RestMethod 'https://itunes.apple.com/search?term=Anitta+cantora&entity=song&limit=5'
Write-Host "=== iTunes: Anitta cantora ==="
foreach ($r in $itunes.results) {
    Write-Host "Track: $($r.trackName) | Artist: $($r.artistName) | Art: $($r.artworkUrl100)"
}

$itunes2 = Invoke-RestMethod 'https://itunes.apple.com/search?term=Anitta&entity=musicArtist&limit=3'
Write-Host "`n=== iTunes: Anitta artist ==="
foreach ($r in $itunes2.results) {
    Write-Host "Artist: $($r.artistName) | Art: $($r.artworkUrl100)"
}

$deezer = Invoke-RestMethod 'https://api.deezer.com/search/artist?q=Anitta+cantora&limit=3'
Write-Host "`n=== Deezer: Anitta cantora ==="
foreach ($a in $deezer.data) {
    Write-Host "Artist: $($a.name) | Pic: $($a.picture_xl)"
}

$lastfm = Invoke-RestMethod 'https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=Anitta+cantora&format=json'
Write-Host "`n=== Last.fm: Anitta cantora ==="
$lastfm.artist.image | Where-Object { $_.'#text' } | ForEach-Object {
    Write-Host "Size: $($_.size) | URL: $($_.'#text')"
}
