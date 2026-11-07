"""Generate the app's code-drawn icons using only the Python standard library."""
import struct
import zlib
from pathlib import Path

def icon(size, filename):
    scale = 3
    n = size * scale
    bg, fg = (8,100,201), (255,255,255)
    strokes = [(142,202,142,310), (199,165,199,347), (313,165,313,347), (370,202,370,310), (199,256,313,256)]
    def pixel(x,y):
        x, y = x/n*512, y/n*512
        for x1,y1,x2,y2 in strokes:
            dx,dy=x2-x1,y2-y1
            t=max(0,min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)))
            if (x-(x1+t*dx))**2+(y-(y1+t*dy))**2 <= 17**2:
                return fg
        return bg
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            samples=[pixel(x*scale+sx,y*scale+sy) for sx in range(scale) for sy in range(scale)]
            row.extend(sum(p[c] for p in samples)//len(samples) for c in range(3))
        rows.append(row)
    def chunk(kind,data):
        return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    Path('public',filename).write_bytes(data)

for size,name in [(32,'favicon-blue.png'),(180,'apple-touch-icon.png'),(192,'pwa-192.png'),(512,'pwa-512.png'),(512,'pwa-maskable.png')]:
    icon(size,name)
