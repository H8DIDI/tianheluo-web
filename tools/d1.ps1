# 站长用：对统计数据库 tianheluo-stats（D1）执行一条 SQL，结果以表格显示。
# 需要 Windows 用户环境变量 CLOUDFLARE_API_TOKEN（有 D1 读写权限）和 CLOUDFLARE_ACCOUNT_ID。
# 用法：
#   .\tools\d1.ps1 "SELECT name, COUNT(*) n FROM events GROUP BY name ORDER BY n DESC"
#   .\tools\d1.ps1 -Report events-today      # 预设报表，见下方 $Reports
param(
  [string]$Sql,
  [string]$Report,
  [string]$Database = "tianheluo-stats"
)

$Reports = @{
  "events-today"   = "SELECT name, COUNT(*) AS n FROM events WHERE day = date('now') GROUP BY name ORDER BY n DESC"
  "events-7d"      = "SELECT day, name, COUNT(*) AS n FROM events WHERE day >= date('now','-7 day') GROUP BY day, name ORDER BY day DESC, n DESC"
  "visitors-geo"   = "SELECT country, region, city, COUNT(DISTINCT ip) AS ips, COUNT(*) AS n FROM events WHERE ip IS NOT NULL GROUP BY country, region, city ORDER BY n DESC LIMIT 50"
  "recent-events"  = "SELECT datetime(ts,'unixepoch','localtime') AS t, name, path, value, prop, ip, city FROM events ORDER BY ts DESC LIMIT 50"
  "no-result-search" = "SELECT prop AS q, COUNT(*) AS n FROM events WHERE name='hud_query' AND value=0 GROUP BY prop ORDER BY n DESC LIMIT 30"
  "top-search"     = "SELECT prop AS q, COUNT(*) AS n FROM events WHERE name IN ('hud_query','store_search') GROUP BY prop ORDER BY n DESC LIMIT 30"
  "404"            = "SELECT path, prop AS from_page, COUNT(*) AS n FROM events WHERE name='hit_404' GROUP BY path, prop ORDER BY n DESC LIMIT 30"
  "js-errors"      = "SELECT path, prop, COUNT(*) AS n FROM events WHERE name='js_error' GROUP BY path, prop ORDER BY n DESC LIMIT 30"
  "lcp"            = "SELECT path, COUNT(*) AS n, ROUND(AVG(value)) AS avg_ms FROM events WHERE name='vital_lcp' GROUP BY path ORDER BY n DESC"
  "downloads-geo"  = "SELECT plugin_id, country, region, city, COUNT(*) AS n FROM download_geo GROUP BY plugin_id, country, region, city ORDER BY n DESC LIMIT 50"
  "downloads-recent" = "SELECT datetime(ts,'unixepoch','localtime') AS t, plugin_id, country, region, city, ip FROM download_geo ORDER BY ts DESC LIMIT 50"
  "downloads-total" = "SELECT plugin_id, SUM(count) AS total FROM downloads GROUP BY plugin_id ORDER BY total DESC"
}

if ($Report) {
  if (-not $Reports.ContainsKey($Report)) { "可用报表：" + (($Reports.Keys | Sort-Object) -join ", "); exit 1 }
  $Sql = $Reports[$Report]
}
if (-not $Sql) { "用法：.\tools\d1.ps1 `"SQL`"  或  .\tools\d1.ps1 -Report <名字>"; "可用报表：" + (($Reports.Keys | Sort-Object) -join ", "); exit 1 }

$t = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "User")
$a = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "User")
if (-not $t -or -not $a) { "缺少环境变量 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID"; exit 1 }
$h = @{ Authorization = "Bearer $t" }
$base = "https://api.cloudflare.com/client/v4/accounts/$a/d1/database"
$db = (Invoke-RestMethod -Uri "${base}?name=${Database}" -Headers $h).result | Select-Object -First 1
if (-not $db) { "找不到数据库 $Database"; exit 1 }
$body = @{ sql = $Sql } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "${base}/$($db.uuid)/query" -Method Post -Headers $h -ContentType "application/json" -Body $body
if (-not $r.success) { $r.errors | ConvertTo-Json; exit 1 }
$rows = $r.result[0].results
if ($rows.Count -eq 0) { "（没有数据）" } else { $rows | Format-Table -AutoSize }
