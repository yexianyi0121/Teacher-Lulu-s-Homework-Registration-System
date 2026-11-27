$ud = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
$best = ''
$bt = [datetime]::MinValue
if (Test-Path $ud) {
  Get-ChildItem -LiteralPath $ud -Directory | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' } | ForEach-Object {
    $n = $_.Name
    $ls = Join-Path $_.FullName 'Local Storage\leveldb'
    if (Test-Path $ls) {
      Get-ChildItem -LiteralPath $ls -Filter *.ldb -ErrorAction SilentlyContinue | ForEach-Object {
        if (Select-String -LiteralPath $_.FullName -Pattern 'xq.state.v4' -SimpleMatch -Quiet -ErrorAction SilentlyContinue) {
          if ($_.LastWriteTime -gt $bt) { $bt = $_.LastWriteTime; $best = $n }
        }
      }
    }
  }
}
if ($best) { Write-Output $best }
