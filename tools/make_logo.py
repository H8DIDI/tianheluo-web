"""天河落 Logo：天河一滴水 × 0.618 黄金对数螺线。按方程生成所有品牌图形，可重复运行。

  python tools/make_logo.py

方程（512×512 画布，SVG 坐标，Y 轴朝下）：
  水珠：x(t) = S·sin t·sin^φ(t/2)，y(t) = S·cos t，t∈[0, 2π]，S = 200，中心 (256, 262)
        tan(t/2) = φ 时达到最大半宽 ≈ 0.688S，与设计文档一致。
  螺线：中心 c = (0, −0.236S)，r(θ) = 100·φ^(−2θ/π)，x = −r·sinθ，y = c_y + r·cosθ，逆时针旋入。
  φ = (1+√5)/2。

输出：
  img/logo-mark.svg    主图版（≥64px，渐变水珠 + 白螺线 θ∈[0,3.5π]，线宽 13）
  img/logo-nav.svg     顶栏版（28px，θ∈[0,2.6π]，线宽 24）
  img/logo-small.svg   小尺寸版（16–32px，纯色水珠，θ∈[0,2.3π]，线宽 30）
  favicon.ico          16/32 用小尺寸版，48/256 用主图版
  favicon-production.png（512）、icon-48/96/192.png（搜索与标签页图标）、apple-touch-icon.png（180，不透明深底）、og-image.png（1200×630）
PNG/ICO/OG 需要 Pillow；只生成 SVG 时不需要。
"""
import math
import pathlib
import struct
import sys

sys.stdout.reconfigure(encoding="utf-8")

SITE = pathlib.Path(__file__).resolve().parent.parent
PHI = (1 + 5 ** 0.5) / 2
S = 200.0
CX, CY = 256.0, 262.0
R0 = 100.0
SPIRAL_CY = -0.236 * S
DROP_TOP, DROP_BOTTOM = CY - S, CY + S   # 62 与 462
C_TOP, C_MID, C_DEEP, C_INK = "#3FA9FF", "#1668DC", "#0B4FC4", "#0B2A5B"
BG = "#06080E"
FONT_REG = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def drop_points(n=720):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = S * math.sin(t) * (math.sin(t / 2) ** PHI)   # sin(t/2) ≥ 0 on [0, 2π]
        y = S * math.cos(t)
        pts.append((CX + x, CY - y))
    return pts


def spiral_points(theta_max, n=720):
    pts = []
    for i in range(n + 1):
        th = theta_max * i / n
        r = R0 * PHI ** (-2 * th / math.pi)
        x = -r * math.sin(th)
        y = SPIRAL_CY + r * math.cos(th)
        pts.append((CX + x, CY - y))
    return pts


def path_d(pts, closed=False):
    d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts)
    return d + (" Z" if closed else "")


VARIANTS = {
    # name: (drop 填充, 螺线 θ 最大值, 线宽, 是否渐变)
    "main": ("grad", 3.5 * math.pi, 13),
    "nav": ("grad", 2.6 * math.pi, 24),
    "small": ((C_MID, None), 2.3 * math.pi, 30),
}


def make_svg(variant):
    fill, theta, stroke = VARIANTS[variant]
    drop = path_d(drop_points(), closed=True)
    spiral = path_d(spiral_points(theta))
    if fill == "grad":
        defs = (f'<defs><linearGradient id="thl-drop" gradientUnits="userSpaceOnUse" x1="0" y1="{DROP_TOP:.0f}" x2="0" y2="{DROP_BOTTOM:.0f}">'
                f'<stop offset="0" stop-color="{C_TOP}"/><stop offset="1" stop-color="{C_DEEP}"/></linearGradient></defs>')
        drop_fill = "url(#thl-drop)"
    else:
        defs = ""
        drop_fill = fill[0]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">{defs}'
            f'<path d="{drop}" fill="{drop_fill}"/>'
            f'<path d="{spiral}" fill="none" stroke="#FFFFFF" stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'</svg>\n')


def write_svgs():
    out = SITE / "img"
    out.mkdir(exist_ok=True)
    names = {"main": "logo-mark.svg", "nav": "logo-nav.svg", "small": "logo-small.svg"}
    for v, name in names.items():
        (out / name).write_text(make_svg(v), encoding="utf-8", newline="\n")
        print("  ·", f"img/{name}")


def render(variant, size, ss=4, bg=None):
    """Pillow 超采样渲染：先放大画布画，再缩小，边缘更顺。"""
    from PIL import Image, ImageDraw
    fill, theta, stroke = VARIANTS[variant]
    W = size * ss
    k = W / 512.0
    img = Image.new("RGBA", (W, W), bg if bg else (0, 0, 0, 0))
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon([(x * k, y * k) for x, y in drop_points()], fill=255)
    if fill == "grad":
        def hexrgb(h):
            return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
        c0, c1 = hexrgb(C_TOP), hexrgb(C_DEEP)
        grad = Image.new("RGBA", (W, W))
        gd = ImageDraw.Draw(grad)
        y0, y1 = DROP_TOP * k, DROP_BOTTOM * k
        for yy in range(W):
            t = min(1.0, max(0.0, (yy - y0) / (y1 - y0)))
            gd.line([(0, yy), (W, yy)], fill=tuple(round(a + (b - a) * t) for a, b in zip(c0, c1)) + (255,))
    else:
        grad = Image.new("RGBA", (W, W), tuple(int(C_MID[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    img.paste(grad, (0, 0), mask)
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    pts = [(x * k, y * k) for x, y in spiral_points(theta)]
    w = stroke * k
    for a, b in zip(pts, pts[1:]):
        ld.line([a, b], fill=(255, 255, 255, 255), width=max(1, round(w)))
    for x, y in pts:   # 圆形端点，等效圆头线帽与连接
        ld.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=(255, 255, 255, 255))
    img.alpha_composite(layer)
    return img.resize((size, size), Image.LANCZOS)


def write_ico(path, entries):
    """ICO 容器，里面放 PNG（Windows Vista 起支持）。entries: [(size, PIL.Image)]"""
    import io
    blobs = []
    for size, im in entries:
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        blobs.append((size, buf.getvalue()))
    header = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    directory = b""
    body = b""
    for size, data in blobs:
        dim = 0 if size >= 256 else size
        directory += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset + len(body))
        body += data
    path.write_bytes(header + directory + body)


def write_pngs():
    from PIL import Image, ImageDraw, ImageFont
    root = SITE
    (root / "favicon-production.png").parent.mkdir(exist_ok=True)
    render("main", 512).save(root / "favicon-production.png", optimize=True)
    print("  · favicon-production.png (512)")
    # 搜索引擎与浏览器标签用的 PNG：Google 要求搜索图标为 48 的整数倍（48/96/192）
    for px in (48, 96, 192):
        render("main", px).save(root / f"icon-{px}.png", optimize=True)
        print(f"  · icon-{px}.png")
    opaque = tuple(int(BG[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    render("main", 180, bg=opaque).convert("RGB").save(root / "apple-touch-icon.png", optimize=True)
    print("  · apple-touch-icon.png (180)")
    write_ico(root / "favicon.ico", [
        (16, render("small", 16, ss=8)),
        (32, render("small", 32, ss=8)),
        (48, render("main", 48)),
        (256, render("main", 256)),
    ])
    print("  · favicon.ico (16/32/48/256)")
    # 社交分享图 1200×630
    W, H = 1200, 630
    og = Image.new("RGB", (W, H), tuple(int(BG[i:i + 2], 16) for i in (1, 3, 5)))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([150, 110, 470, 520], fill=(22, 104, 220, 110))   # 光晕收在画布内，不贴边
    from PIL import ImageFilter
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    og.paste(glow, (0, 0), glow)
    mark = render("main", 380)
    og.paste(mark, (110, 125), mark)
    f_big = ImageFont.truetype(FONT_BOLD, 120)
    f_mid = ImageFont.truetype(FONT_REG, 30)
    f_url = ImageFont.truetype(FONT_BOLD, 30)
    d = ImageDraw.Draw(og)
    d.text((520, 205), "天河落", font=f_big, fill=(248, 250, 252))
    d.text((524, 352), "Revit 2026 插件宿主与开源插件商店", font=f_mid, fill=(148, 163, 184))
    d.text((524, 420), "tianheluo.com", font=f_url, fill=(63, 169, 255))
    og.save(root / "og-image.png", optimize=True)
    print("  · og-image.png (1200×630)")


if __name__ == "__main__":
    print("SVG：")
    write_svgs()
    try:
        import PIL  # noqa: F401
    except ImportError:
        print("未安装 Pillow，跳过 PNG/ICO/OG（pip install pillow 后重跑）")
        sys.exit(0)
    print("PNG / ICO / OG：")
    write_pngs()
