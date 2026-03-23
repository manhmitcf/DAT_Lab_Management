import xml.etree.ElementTree as ET
import sys
import re

def drawio_to_svg(input_path, output_path):
    tree = ET.parse(input_path)
    root = tree.getroot()
    
    # We will search for mxCell containing mxGeometry
    max_x = 0
    max_y = 0
    min_x = 100000
    min_y = 100000
    
    cells = []
    for cell in root.iter('mxCell'):
        geo = cell.find('mxGeometry')
        if geo is not None:
            x = float(geo.get('x', 0))
            y = float(geo.get('y', 0))
            w = float(geo.get('width', 0))
            h = float(geo.get('height', 0))
            
            p = cell.get('parent')
            rotation = 0
            
            style = cell.get('style', '')
            fillColor = 'transparent'
            strokeColor = '#666' # default stroke
            
            m = re.search(r'fillColor=([^;]+)', style)
            if m and m.group(1) != 'none':
                fillColor = m.group(1)
                
            m = re.search(r'strokeColor=([^;]+)', style)
            if m and m.group(1) != 'none':
                strokeColor = m.group(1)
            
            m = re.search(r'rotation=([^;]+)', style)
            if m:
                rotation = float(m.group(1))

            text = cell.get('value', '')
            text = re.sub(r'<[^>]+>', '', text)
            
            cells.append({
                'id': cell.get('id'),
                'x': x, 'y': y, 'w': w, 'h': h,
                'fill': fillColor, 'stroke': strokeColor,
                'text': text, 'rotation': rotation, 'parent': p,
                'is_text_only': 'text;' in style or fillColor == 'transparent' and strokeColor == 'none'
            })
            
            if w > 0 and h > 0:
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x + w > max_x: max_x = x + w
                if y + h > max_y: max_y = y + h

    # Calculate padding
    pad = 20
    out_w = (max_x - min_x) + pad*2
    out_h = (max_y - min_y) + pad*2

    # SVG header
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {out_w} {out_h}" width="100%" height="100%">']
    svg.append(f'  <g transform="translate({-min_x + pad}, {-min_y + pad})">')
    
    # Add a background rect
    svg.append(f'    <rect x="{min_x-pad/2}" y="{min_y-pad/2}" width="{out_w-pad}" height="{out_h-pad}" fill="#f8fafc" rx="8" />')

    for c in cells:
        x, y, w, h = c['x'], c['y'], c['w'], c['h']
        rx = x + w/2
        ry = y + h/2
        
        transform = ""
        if c['rotation'] != 0:
            transform = f' transform="rotate({c["rotation"]} {rx} {ry})"'
            
        if w > 0 and h > 0 and c['fill'] != 'transparent':
            if c['stroke'] == 'none':
                c['stroke'] = 'transparent'
            svg.append(f'    <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c["fill"]}" stroke="{c["stroke"]}" stroke-width="2"{transform} rx="4" />')
            
        if c['text']:
            # Replace some encoded html entities
            t = c['text'].replace('&nbsp;', ' ')
            # simple text positioning
            font_weight = "bold" if "font-weight" in t.lower() or len(t) < 3 else "normal"
            svg.append(f'    <text x="{rx}" y="{ry}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="{font_weight}" text-anchor="middle" dominant-baseline="central" fill="#334155"{transform}>{t}</text>')

    svg.append('  </g>')
    svg.append('</svg>')
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(svg))

    print(f"Exported to {output_path}. Size: {out_w}x{out_h}")

if __name__ == "__main__":
    drawio_to_svg(sys.argv[1], sys.argv[2])
