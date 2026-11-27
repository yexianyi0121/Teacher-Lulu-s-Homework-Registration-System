$ErrorActionPreference = 'SilentlyContinue'
function Find-Stores {
  $res = @()
  $targets = @(
    @{ B='Edge'; UD=(Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data') },
    @{ B='Chrome'; UD=(Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data') }
  )
  foreach ($t in $targets) {
    if (-not (Test-Path $t.UD)) { continue }
    Get-ChildItem -LiteralPath $t.UD -Directory | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' } | ForEach-Object {
      $ls = Join-Path $_.FullName 'Local Storage\leveldb'
      if (Test-Path $ls) {
        $hit = Get-ChildItem -LiteralPath $ls -Filter *.ldb | Where-Object { Select-String -LiteralPath $_.FullName -Pattern 'xq.state.v4' -SimpleMatch -Quiet }
        if ($hit) {
          $newest = $hit | Sort-Object LastWriteTime -Descending | Select-Object -First 1
          $res += [pscustomobject]@{ Browser=$t.B; Profile=$_.Name; LastWrite=$newest.LastWriteTime; KB=[math]::Round((($hit | Measure-Object Length -Sum).Sum)/1KB) }
        }
      }
    }
  }
  return $res
}
function Open-App($store) {
  $html = Join-Path $PSScriptRoot '..\学情登记系统.html'
  if (-not (Test-Path $html)) { $html = Join-Path $PSScriptRoot '..\index.html' }
  $path = (Resolve-Path $html).Path -replace '\','/'
  $url = 'file:///' + $path
  $exe = if ($store.Browser -eq 'Chrome') { 'chrome.exe' } else { 'msedge.exe' }
  Start-Process $exe -ArgumentList "--profile-directory=$($store.Profile)","--app=$url"
}
function Restore-Backup {
  $bakRoot = Join-Path $env:LOCALAPPDATA 'XueQingBackup'
  if (-not (Test-Path $bakRoot)) { Write-Host '没有自动备份。' -ForegroundColor Yellow; return }
  $dirs = Get-ChildItem -LiteralPath $bakRoot -Directory | Sort-Object Name -Descending
  if (-not $dirs) { Write-Host '没有自动备份。' -ForegroundColor Yellow; return }
  for ($i=0; $i -lt $dirs.Count; $i++) {
    $pfile = Join-Path $dirs[$i].FullName 'profile.txt'
    $prof = if (Test-Path $pfile) { (Get-Content $pfile -Raw).Trim() } else { '?' }
    Write-Host ("[{0}] {1}   配置：{2}" -f ($i+1), $dirs[$i].Name, $prof)
  }
  $sel = Read-Host '输入要恢复的编号（回车取消）'
  if (-not $sel) { return }
  $idx = [int]$sel - 1
  if ($idx -lt 0 -or $idx -ge $dirs.Count) { return }
  $src = $dirs[$idx].FullName
  $pfile = Join-Path $src 'profile.txt'
  $profName = if (Test-Path $pfile) { (Get-Content $pfile -Raw).Trim() } else { 'Default' }
  if (-not $profName) { $profName = 'Default' }
  if (Get-Process msedge -ErrorAction SilentlyContinue) { Write-Host '请先关闭所有 Edge 窗口（包括本系统的窗口），再运行恢复。' -ForegroundColor Red; return }
  $ud = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
  $dstLevel = Join-Path $ud "$profName\Local Storage\leveldb"
  $dstIdb = Join-Path $ud "$profName\IndexedDB\file__0.indexeddb.leveldb"
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  if (Test-Path $dstLevel) { Rename-Item $dstLevel "leveldb.before-restore-$stamp" -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $dstLevel | Out-Null
  Copy-Item (Join-Path $src 'LocalStorage\*') $dstLevel -Force
  if (Test-Path (Join-Path $src 'IndexedDB')) {
    if (Test-Path $dstIdb) { Rename-Item $dstIdb "file__0.indexeddb.leveldb.before-restore-$stamp" -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $dstIdb | Out-Null
    Copy-Item (Join-Path $src 'IndexedDB\*') $dstIdb -Force
  }
  Write-Host '已恢复。请重新双击「启动学情登记系统.cmd」打开。' -ForegroundColor Green
}
while ($true) {
  Write-Host ''
  Write-Host '===== 学情登记管理系统 · 数据恢复与排查 =====' -ForegroundColor Cyan
  Write-Host '[1] 扫描并列出所有含数据的浏览器配置'
  Write-Host '[2] 从自动备份恢复（最近 20 次）'
  Write-Host '[3] 扫描并打开数据所在配置'
  Write-Host '[0] 退出'
  $c = Read-Host '请选择'
  if ([string]::IsNullOrWhiteSpace($c)) { return }
  switch ($c) {
    '1' { $all = Find-Stores; if (-not $all) { Write-Host '没有找到含 xq.state.v4 的配置。' -ForegroundColor Yellow } else { $all | Format-Table Browser,Profile,LastWrite,KB -AutoSize } }
    '2' { Restore-Backup }
    '3' { $all = Find-Stores; if (-not $all) { Write-Host '未找到数据。' -ForegroundColor Yellow } else { for ($i=0;$i -lt $all.Count;$i++){ Write-Host ("[{0}] {1} / {2} / 最后写入 {3}" -f ($i+1), $all[$i].Browser, $all[$i].Profile, $all[$i].LastWrite) }; $s=Read-Host '输入编号打开（回车取消）'; if($s){ $k=[int]$s-1; if($k -ge 0 -and $k -lt $all.Count){ Open-App $all[$k] } } } }
    '0' { return }
    default { Write-Host '无效选择' }
  }
}
