import os
from PIL import Image, ImageDraw

def create_hub_icon(size: int, output_path: str):
    # Create image with RGBA
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background
    corner_radius = int(size * 0.22)
    bg_color = (15, 23, 42, 255) # Slate 900
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, fill=bg_color)

    # Draw border subtle highlight
    border_color = (30, 41, 59, 255) # Slate 800
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, outline=border_color, width=max(1, size // 64))

    # Center glyph: Hub nodes and trending line
    # Calculate key points relative to size
    p1 = (int(size * 0.24), int(size * 0.68))
    p2 = (int(size * 0.44), int(size * 0.52))
    p3 = (int(size * 0.60), int(size * 0.60))
    p4 = (int(size * 0.78), int(size * 0.30))

    # Trend line shadow / glow
    line_width = max(3, int(size * 0.055))
    glow_color = (16, 185, 129, 60)
    draw.line([p1, p2, p3, p4], fill=glow_color, width=line_width + 8, joint="curve")

    # Main trend line (Emerald 500: #10b981)
    main_line_color = (16, 185, 129, 255)
    draw.line([p1, p2, p3, p4], fill=main_line_color, width=line_width, joint="curve")

    # Upward arrow tip on p4
    arrow_size = int(size * 0.08)
    arrow_pts = [
        p4,
        (p4[0] - arrow_size, p4[1] + int(arrow_size * 0.2)),
        (p4[0] - int(arrow_size * 0.2), p4[1] + arrow_size)
    ]
    draw.polygon(arrow_pts, fill=main_line_color)

    # Nodes (circles at each point)
    node_radius = max(3, int(size * 0.045))
    for pt in [p1, p2, p3]:
        # outer circle
        draw.ellipse([pt[0] - node_radius, pt[1] - node_radius, pt[0] + node_radius, pt[1] + node_radius], fill=(52, 211, 153, 255))
        # inner core
        inner_r = max(1, node_radius // 2)
        draw.ellipse([pt[0] - inner_r, pt[1] - inner_r, pt[0] + inner_r, pt[1] + inner_r], fill=(255, 255, 255, 255))

    # Save PNG
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Generated {output_path} ({size}x{size})")

if __name__ == "__main__":
    public_dir = os.path.abspath("frontend/public")
    create_hub_icon(192, os.path.join(public_dir, "icon-192.png"))
    create_hub_icon(512, os.path.join(public_dir, "icon-512.png"))
    create_hub_icon(180, os.path.join(public_dir, "apple-touch-icon.png"))
