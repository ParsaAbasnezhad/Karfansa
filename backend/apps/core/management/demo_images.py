"""Deterministic, original artwork for local demo records."""

from __future__ import annotations

import colorsys
import hashlib
import math
import random
from io import BytesIO

from PIL import Image, ImageDraw


def _color(hue: float, saturation: float, value: float) -> tuple[int, int, int]:
    return tuple(round(channel * 255) for channel in colorsys.hsv_to_rgb(hue, saturation, value))


def render_demo_image(kind: str, key: str) -> bytes:
    """Return a distinct WebP illustration without external assets or fonts."""
    seed = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big")
    rng = random.Random(seed)  # noqa: S311 - deterministic illustration, no security use
    hue = (seed % 360) / 360
    if kind in {"logo", "avatar"}:
        width, height = 320, 320
    elif kind == "cover":
        width, height = 1200, 400
    else:
        width, height = 960, 640

    base = _color(hue, 0.57, 0.56)
    dark = _color(hue, 0.64, 0.29)
    light = _color((hue + 0.075) % 1, 0.30, 0.94)
    accent = _color((hue + 0.15) % 1, 0.68, 0.85)
    canvas = Image.new("RGB", (width, height), dark)
    draw = ImageDraw.Draw(canvas)
    for y in range(height):
        blend = y / max(height - 1, 1)
        draw.line(
            (0, y, width, y),
            fill=tuple(round(dark[i] * (1 - blend) + base[i] * blend) for i in range(3)),
        )

    if kind == "logo":
        inset = 28
        draw.rounded_rectangle(
            (inset, inset, width - inset, height - inset), radius=64, outline=light, width=4
        )
        points = []
        sides = 5 + seed % 3
        for index in range(sides):
            angle = -math.pi / 2 + index * math.tau / sides
            radius = width * (0.26 if index % 2 == 0 else 0.20)
            points.append(
                (width / 2 + math.cos(angle) * radius, height / 2 + math.sin(angle) * radius)
            )
        draw.polygon(points, fill=light)
        draw.ellipse((width * 0.43, height * 0.43, width * 0.57, height * 0.57), fill=accent)
    elif kind == "avatar":
        draw.ellipse((22, 22, 298, 298), fill=light)
        draw.ellipse((114, 68, 206, 160), fill=dark)
        draw.rounded_rectangle((67, 171, 253, 302), radius=82, fill=base)
        draw.arc((50, 42, 270, 288), 190, 345, fill=accent, width=7)
        draw.ellipse((243, 56, 270, 83), fill=accent)
    else:
        for index in range(9):
            radius = rng.randrange(70, 215) if kind == "listing" else rng.randrange(90, 300)
            x = rng.randrange(-100, width + 100)
            y = rng.randrange(-100, height + 100)
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius), outline=light, width=2 + index % 3
            )
        if kind == "listing":
            left = round(width * (0.29 + rng.random() * 0.06))
            top = round(height * (0.27 + rng.random() * 0.07))
            right = width - left
            bottom = height - top
            draw.rounded_rectangle((left, top, right, bottom), radius=48, fill=light)
            category = key.partition(":")[0]
            cx, cy = width // 2, height // 2
            if any(
                word in category
                for word in ("غلات", "حبوبات", "میوه", "خشکبار", "غذایی", "کشاورزی")
            ):
                draw.ellipse((cx - 90, cy - 50, cx + 50, cy + 90), fill=base)
                draw.ellipse((cx - 20, cy - 75, cx + 90, cy + 45), fill=accent)
                draw.polygon(
                    ((cx - 12, cy - 64), (cx + 58, cy - 105), (cx + 46, cy - 50)), fill=dark
                )
            elif any(word in category for word in ("حمل", "لجستیک", "بازرگانی")):
                draw.rounded_rectangle((cx - 120, cy - 40, cx + 40, cy + 53), radius=12, fill=base)
                draw.polygon(
                    (
                        (cx + 40, cy - 15),
                        (cx + 92, cy - 15),
                        (cx + 120, cy + 53),
                        (cx + 40, cy + 53),
                    ),
                    fill=accent,
                )
                draw.ellipse((cx - 81, cy + 34, cx - 35, cy + 80), fill=dark)
                draw.ellipse((cx + 64, cy + 34, cx + 110, cy + 80), fill=dark)
            elif any(word in category for word in ("نرم", "تجهیزات فروشگاهی")):
                for offset in (-70, 0, 70):
                    draw.line((cx - 120, cy + offset, cx + 120, cy + offset), fill=base, width=9)
                    draw.ellipse(
                        (cx + offset - 16, cy + offset - 16, cx + offset + 16, cy + offset + 16),
                        fill=accent,
                    )
                draw.rounded_rectangle((cx - 47, cy - 47, cx + 47, cy + 47), radius=15, fill=dark)
            elif "دستی" in category:
                draw.polygon(
                    (
                        (cx - 65, cy - 85),
                        (cx + 65, cy - 85),
                        (cx + 85, cy + 68),
                        (cx - 85, cy + 68),
                    ),
                    fill=base,
                )
                draw.ellipse((cx - 40, cy - 17, cx + 40, cy + 47), outline=accent, width=14)
            else:
                draw.rounded_rectangle((cx - 105, cy - 75, cx + 105, cy + 75), radius=20, fill=base)
                draw.line((cx - 105, cy - 20, cx + 105, cy - 20), fill=accent, width=12)
                draw.line((cx - 45, cy - 75, cx - 45, cy + 75), fill=accent, width=12)
        else:
            for index in range(3):
                x = width * (0.58 + index * 0.11)
                draw.line((x, -20, x - 220, height + 20), fill=light, width=8)

    draw.text((width - 46, height - 18), "DEMO", fill=light)

    output = BytesIO()
    canvas.save(output, format="WEBP", quality=84, method=6)
    return output.getvalue()
