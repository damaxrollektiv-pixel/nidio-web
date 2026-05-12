import struct, zlib, base64

def create_png(size):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    
    # Purple background #534AB7 with white pin
    r, g, b = 0x53, 0x4A, 0xB7
    rows = []
    for y in range(size):
        row = [0]
        for x in range(size):
            # Rounded corner mask
            cx, cy = size//2, size//2
            rx, ry = size*0.45, size*0.45
            corner_r = size * 0.22
            in_rect = (corner_r < x < size-corner_r) or (corner_r < y < size-corner_r)
            in_circle = ((x-corner_r)**2 + (y-corner_r)**2 < corner_r**2 or
                        (x-(size-corner_r))**2 + (y-corner_r)**2 < corner_r**2 or
                        (x-corner_r)**2 + (y-(size-corner_r))**2 < corner_r**2 or
                        (x-(size-corner_r))**2 + (y-(size-corner_r))**2 < corner_r**2)
            in_shape = in_rect or in_circle
            
            # Pin shape
            pin_cx, pin_cy = size//2, size*0.38
            pin_r = size * 0.18
            pin_tail_y = size * 0.72
            in_pin_head = (x-pin_cx)**2 + (y-pin_cy)**2 < pin_r**2
            in_pin_tail = (abs(x - pin_cx) < size*0.04 and pin_cy < y < pin_tail_y)
            in_dot = (x-pin_cx)**2 + (y-pin_cy)**2 < (pin_r*0.4)**2
            
            if not in_shape:
                row += [r, g, b, 0]
            elif in_dot:
                row += [r, g, b, 255]
            elif in_pin_head or in_pin_tail:
                row += [255, 255, 255, 255]
            else:
                row += [r, g, b, 255]
        rows.append(bytes(row))
    
    raw = b''.join(rows)
    compressed = zlib.compress(raw)
    
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')
    return png

for size in [192, 512]:
    with open(f'/home/claude/nidio_pwa/public/icon-{size}.png', 'wb') as f:
        f.write(create_png(size))
    print(f'icon-{size}.png created')
