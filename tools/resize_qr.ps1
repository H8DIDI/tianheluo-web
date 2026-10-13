# 换了微信二维码（wechat-didi.png）之后运行：重新生成页脚用的小图 wechat-didi-sm.png（240x240）。
# 用法（在网站仓库根目录）：powershell -ExecutionPolicy Bypass -File tools\resize_qr.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$img = [System.Drawing.Image]::FromFile((Join-Path $root 'wechat-didi.png'))
$bmp = New-Object System.Drawing.Bitmap 240, 240
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
$g.DrawImage($img, 0, 0, 240, 240)
$g.Dispose(); $img.Dispose()
$out = Join-Path $root 'wechat-didi-sm.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
"已生成 $out （$([math]::Round((Get-Item $out).Length / 1KB)) KB）"
