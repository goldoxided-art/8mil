import { useState, useRef, useEffect, useCallback } from “react”;
import { createClient } from “@supabase/supabase-js”;

const SUPABASE_URL = “https://jjfnyajgyzngvmpnrhbu.supabase.co”;
const SUPABASE_KEY = “sb_publishable_hyUgnThgXkUiwNJ0VY1z_g_CbEUHSSf”;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CANVAS_W = 1600;
const CANVAS_H = 500;
const TOTAL_PIXELS = 8000000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 40;

export default function App() {
const [blocks, setBlocks] = useState([]);
const [loading, setLoading] = useState(true);
const [drawColor, setDrawColor] = useState(”#e63946”);
const [drawnPixels, setDrawnPixels] = useState([]);
const [history, setHistory] = useState([]);
const [redoStack, setRedoStack] = useState([]);
const [isDrawing, setIsDrawing] = useState(false);
const [zoom, setZoom] = useState(1);
const [pan, setPan] = useState({ x: 0, y: 0 });
const [isPanning, setIsPanning] = useState(false);
const [lastPan, setLastPan] = useState(null);
const [showModal, setShowModal] = useState(false);
const [form, setForm] = useState({ name: “” });
const [toast, setToast] = useState(””);
const [activeTab, setActiveTab] = useState(“leaderboard”);
const [mode, setMode] = useState(“view”);
const canvasRef = useRef(null);
const animRef = useRef(null);
const containerRef = useRef(null);

useEffect(() => {
loadPixels();
const channel = supabase.channel(“pixels”)
.on(“postgres_changes”, { event: “INSERT”, schema: “public”, table: “pixels” }, payload => {
setBlocks(prev => […prev, payload.new]);
}).subscribe();
return () => supabase.removeChannel(channel);
}, []);

const loadPixels = async () => {
setLoading(true);
const { data } = await supabase.from(“pixels”).select(”*”);
if (data) setBlocks(data);
setLoading(false);
};

const totalSold = blocks.reduce((s, b) => s + b.w * b.h, 0) + drawnPixels.length;
const pct = ((totalSold / TOTAL_PIXELS) * 100).toFixed(3);

const leaderboard = Object.values(
blocks.reduce((acc, b) => {
if (!acc[b.owner]) acc[b.owner] = { name: b.owner, pixels: 0 };
acc[b.owner].pixels += b.w * b.h;
return acc;
}, {})
).sort((a, b) => b.pixels - a.pixels);

const screenToCanvas = useCallback((screenX, screenY) => {
const container = containerRef.current;
if (!container) return { x: 0, y: 0 };
const rect = container.getBoundingClientRect();
return {
x: Math.floor((screenX - rect.left - pan.x) / zoom),
y: Math.floor((screenY - rect.top - pan.y) / zoom)
};
}, [pan, zoom]);

const getClientPos = (e) => {
if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
return { x: e.clientX, y: e.clientY };
};

const draw = useCallback(() => {
const canvas = canvasRef.current;
if (!canvas) return;
const ctx = canvas.getContext(“2d”);
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.save();
ctx.translate(pan.x, pan.y);
ctx.scale(zoom, zoom);

```
ctx.fillStyle = "#f0ede8";
ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

if (zoom > 3) {
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 0.5 / zoom;
  for (let x = 0; x <= CANVAS_W; x += 10) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_H; y += 10) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
}

blocks.forEach(b => {
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  if (zoom > 2 && b.w > 40 && b.h > 14) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(b.x + 1, b.y + b.h / 2 - 7, b.w - 2, 14);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = "bold " + Math.min(9, b.h * 0.2) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.owner.substring(0, 12), b.x + b.w / 2, b.y + b.h / 2);
  }
});

drawnPixels.forEach(p => {
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x, p.y, 1, 1);
});

ctx.strokeStyle = "rgba(0,0,0,0.15)";
ctx.lineWidth = 2 / zoom;
ctx.strokeRect(0, 0, CANVAS_W, CANVAS_H);
ctx.restore();

if (zoom <= 1.5) {
  ctx.save();
  const frameColor = "#1a1a2e";
  const fx = pan.x - 20;
  const fy = pan.y - 20;
  const fw = CANVAS_W * zoom + 40;
  const fh = CANVAS_H * zoom + 40;
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(fx, fy, fw, fh);
  ctx.fillStyle = frameColor;
  ctx.fillRect(fx + fw * 0.3 - 6, fy + fh, 12, 60);
  ctx.fillRect(fx + fw * 0.7 - 6, fy + fh, 12, 60);
  ctx.restore();
}
```

}, [blocks, drawnPixels, zoom, pan]);

useEffect(() => {
const canvas = canvasRef.current;
const container = containerRef.current;
if (!canvas || !container) return;
canvas.width = container.clientWidth;
canvas.height = container.clientHeight;
}, []);

useEffect(() => {
const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
animRef.current = requestAnimationFrame(loop);
return () => cancelAnimationFrame(animRef.current);
}, [draw]);

useEffect(() => {
const container = containerRef.current;
if (!container) return;
const cw = container.clientWidth;
const ch = container.clientHeight;
setPan({ x: (cw - CANVAS_W * MIN_ZOOM) / 2, y: (ch - CANVAS_H * MIN_ZOOM) / 2 });
}, []);

const handleWheel = useCallback((e) => {
e.preventDefault();
const { x: cx, y: cy } = getClientPos(e);
const container = containerRef.current;
const rect = container.getBoundingClientRect();
const mouseX = cx - rect.left;
const mouseY = cy - rect.top;
const delta = e.deltaY > 0 ? 0.85 : 1.18;
setZoom(prev => {
const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta));
setPan(p => ({
x: mouseX - (mouseX - p.x) * (newZoom / prev),
y: mouseY - (mouseY - p.y) * (newZoom / prev)
}));
return newZoom;
});
}, []);

useEffect(() => {
const container = containerRef.current;
if (!container) return;
container.addEventListener(“wheel”, handleWheel, { passive: false });
return () => container.removeEventListener(“wheel”, handleWheel);
}, [handleWheel]);

const onPointerDown = useCallback((e) => {
e.preventDefault();
const { x: cx, y: cy } = getClientPos(e);
const pos = screenToCanvas(cx, cy);
if (mode === “draw”) {
if (pos.x >= 0 && pos.x < CANVAS_W && pos.y >= 0 && pos.y < CANVAS_H) {
setIsDrawing(true);
setDrawnPixels(prev => {
if (prev.find(p => p.x === pos.x && p.y === pos.y)) return prev;
return […prev, { x: pos.x, y: pos.y, color: drawColor }];
});
}
} else {
setIsPanning(true);
setLastPan({ x: cx, y: cy });
}
}, [mode, screenToCanvas, drawColor]);

const onPointerMove = useCallback((e) => {
e.preventDefault();
const { x: cx, y: cy } = getClientPos(e);
if (mode === “draw” && isDrawing) {
const pos = screenToCanvas(cx, cy);
if (pos.x >= 0 && pos.x < CANVAS_W && pos.y >= 0 && pos.y < CANVAS_H) {
setDrawnPixels(prev => {
if (prev.find(p => p.x === pos.x && p.y === pos.y)) return prev;
return […prev, { x: pos.x, y: pos.y, color: drawColor }];
});
}
} else if (isPanning && lastPan) {
const dx = cx - lastPan.x;
const dy = cy - lastPan.y;
setPan(p => ({ x: p.x + dx, y: p.y + dy }));
setLastPan({ x: cx, y: cy });
}
}, [mode, isDrawing, isPanning, lastPan, screenToCanvas, drawColor]);

const onPointerUp = useCallback(() => {
if (isDrawing) {
setHistory(prev => […prev, drawnPixels]);
setRedoStack([]);
}
setIsDrawing(false);
setIsPanning(false);
setLastPan(null);
}, [isDrawing, drawnPixels]);

const handleUndo = () => {
if (history.length === 0) return;
const prev = history[history.length - 1];
setRedoStack(r => […r, drawnPixels]);
setDrawnPixels(prev);
setHistory(h => h.slice(0, -1));
};

const handleRedo = () => {
if (redoStack.length === 0) return;
const next = redoStack[redoStack.length - 1];
setHistory(h => […h, drawnPixels]);
setDrawnPixels(next);
setRedoStack(r => r.slice(0, -1));
};

const handleClearAll = () => {
setHistory(h => […h, drawnPixels]);
setRedoStack([]);
setDrawnPixels([]);
};

const handleBuy = async () => {
if (drawnPixels.length === 0) return;
const xs = drawnPixels.map(p => p.x);
const ys = drawnPixels.map(p => p.y);
const x = Math.min(…xs);
const y = Math.min(…ys);
const w = Math.max(…xs) - x + 1;
const h = Math.max(…ys) - y + 1;
const nb = { x, y, w, h, color: drawColor, owner: form.name || “นิรนาม” };
const { error } = await supabase.from(“pixels”).insert([nb]);
if (error) {
setToast(“เกิดข้อผิดพลาด”);
setTimeout(() => setToast(””), 3000);
return;
}
setDrawnPixels([]);
setHistory([]);
setRedoStack([]);
setShowModal(false);
setMode(“view”);
setToast(“ติดบิลบอร์ดแล้ว!”);
setForm({ name: “” });
setTimeout(() => setToast(””), 4000);
};

const pendingPrice = drawnPixels.length;

return (
<div style={{ background: “#0a0a0a”, minHeight: “100vh”, color: “#fff”, fontFamily: “Inter, system-ui, sans-serif”, overflow: “hidden” }}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Sarabun:wght@300;400;600;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } button { cursor: pointer; transition: all 0.15s; } button:hover { opacity: 0.8; } @keyframes fadeUp { from { opacity:0; transform:translateY(6px) translateX(-50%); } to { opacity:1; transform:translateY(0) translateX(-50%); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } } @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>

```
  <header style={{ padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 100 }}>
    <div>
      <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "4px", color: "#fff" }}>8MILBILLBOARD</div>
      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginTop: "2px", fontFamily: "Sarabun" }}>8 ล้านพิกเซล · ฿1/พิกเซล · บิลบอร์ดใหญ่ที่สุด ใจกลางกรุงเทพ</div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>ยอดขายรวม</div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{"฿" + totalSold.toLocaleString()}</div>
      </div>
      {mode === "view" ? (
        <button onClick={() => setMode("draw")} style={{ padding: "10px 20px", background: "#fff", border: "none", color: "#000", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", fontFamily: "Sarabun" }}>
          ✏️ เริ่มวาด
        </button>
      ) : (
        <button onClick={() => { setMode("view"); setDrawnPixels([]); }} style={{ padding: "10px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "12px", fontWeight: 600, fontFamily: "Sarabun" }}>
          ยกเลิก
        </button>
      )}
    </div>
  </header>

  <div style={{ height: "2px", background: "rgba(255,255,255,0.05)" }}>
    <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg, #e63946, #ff6b6b)", minWidth: "2px", transition: "width 0.8s" }} />
  </div>

  <div style={{ position: "relative", height: "70vh", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "linear-gradient(180deg, #0d1b2a 0%, #1b2838 40%, #2d3a4a 70%, #1a1a2e 100%)" }}>
      <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", bottom: 0, width: "100%", opacity: 0.6 }}>
        <path d="M0,400 L0,280 L30,280 L30,240 L50,240 L50,220 L70,220 L70,200 L90,200 L90,180 L110,180 L110,200 L130,200 L130,160 L140,160 L140,140 L150,140 L150,160 L160,160 L160,200 L180,200 L180,220 L200,220 L200,200 L220,200 L220,180 L240,180 L240,160 L260,160 L260,140 L270,140 L270,120 L280,120 L280,100 L290,100 L290,80 L300,80 L300,100 L310,100 L310,120 L320,120 L320,140 L330,140 L330,160 L350,160 L350,180 L370,180 L370,200 L390,200 L390,220 L410,220 L410,240 L430,240 L430,260 L450,260 L450,240 L470,240 L470,220 L490,220 L490,200 L510,200 L510,180 L520,180 L520,160 L530,160 L530,140 L540,140 L540,120 L550,120 L550,100 L560,100 L560,80 L570,80 L570,60 L580,60 L580,80 L590,80 L590,100 L600,100 L600,120 L610,120 L610,140 L620,140 L620,160 L640,160 L640,180 L660,180 L660,200 L680,200 L680,220 L700,220 L700,200 L720,200 L720,180 L740,180 L740,160 L760,160 L760,140 L770,140 L770,120 L780,120 L780,100 L790,100 L790,80 L800,80 L800,100 L810,100 L810,120 L820,120 L820,140 L830,140 L830,160 L850,160 L850,180 L870,180 L870,200 L890,200 L890,220 L910,220 L910,240 L930,240 L930,260 L950,260 L950,240 L970,240 L970,220 L990,220 L990,200 L1010,200 L1010,180 L1030,180 L1030,160 L1050,160 L1050,180 L1070,180 L1070,200 L1090,200 L1090,220 L1110,220 L1110,200 L1130,200 L1130,180 L1150,180 L1150,200 L1170,200 L1170,220 L1190,220 L1190,240 L1210,240 L1210,260 L1230,260 L1230,280 L1260,280 L1260,260 L1290,260 L1290,280 L1320,280 L1320,300 L1350,300 L1350,280 L1380,280 L1380,300 L1410,300 L1410,320 L1440,320 L1440,400 Z" fill="#1a1a2e"/>
        <path d="M0,400 L0,320 L60,320 L60,300 L80,300 L80,280 L100,280 L100,260 L120,260 L120,280 L140,280 L140,300 L160,300 L160,320 L200,320 L200,300 L220,300 L220,280 L240,280 L240,300 L260,300 L260,320 L300,320 L300,300 L320,300 L320,280 L340,280 L340,300 L360,300 L360,320 L400,320 L400,300 L430,300 L430,280 L460,280 L460,300 L490,300 L490,320 L530,320 L530,300 L560,300 L560,280 L590,280 L590,300 L620,300 L620,320 L660,320 L660,300 L700,300 L700,280 L730,280 L730,300 L760,300 L760,320 L800,320 L800,300 L840,300 L840,280 L870,280 L870,300 L900,300 L900,320 L940,320 L940,300 L970,300 L970,280 L1000,280 L1000,300 L1030,300 L1030,320 L1070,320 L1070,300 L1100,300 L1100,280 L1130,280 L1130,300 L1160,300 L1160,320 L1200,320 L1200,300 L1240,300 L1240,320 L1280,320 L1280,300 L1320,300 L1320,320 L1360,320 L1360,340 L1400,340 L1400,320 L1440,320 L1440,400 Z" fill="#23233a"/>
      </svg>
    </div>

    <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 1, touchAction: "none", cursor: mode === "draw" ? "crosshair" : "grab" }}
      onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
      onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>

    {loading && (
      <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    )}

    {mode === "draw" && (
      <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "8px", background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", padding: "10px 16px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "40px", zIndex: 10 }}>
        <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} style={{ width: "32px", height: "32px", border: "2px solid rgba(255,255,255,0.2)", background: "none", cursor: "pointer", padding: "2px", borderRadius: "50%" }} />
        <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />
        <button onClick={handleUndo} disabled={history.length === 0} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: history.length === 0 ? "rgba(255,255,255,0.2)" : "#fff", fontSize: "14px", borderRadius: "8px" }}>↩</button>
        <button onClick={handleRedo} disabled={redoStack.length === 0} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: redoStack.length === 0 ? "rgba(255,255,255,0.2)" : "#fff", fontSize: "14px", borderRadius: "8px" }}>↪</button>
        <button onClick={handleClearAll} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "14px", borderRadius: "8px" }}>🗑</button>
        <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontFamily: "Sarabun", minWidth: "80px" }}>
          {drawnPixels.length.toLocaleString()} px = <strong style={{ color: "#fff" }}>{"฿" + drawnPixels.length.toLocaleString()}</strong>
        </div>
        <button onClick={() => { if (drawnPixels.length > 0) setShowModal(true); }} style={{ padding: "8px 18px", background: drawnPixels.length > 0 ? "#fff" : "rgba(255,255,255,0.1)", border: "none", color: drawnPixels.length > 0 ? "#000" : "rgba(255,255,255,0.3)", fontSize: "12px", fontWeight: 700, fontFamily: "Sarabun", borderRadius: "20px" }}>
          ซื้อเลย
        </button>
      </div>
    )}

    {mode === "view" && !loading && (
      <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "2px", fontFamily: "Sarabun", pointerEvents: "none", zIndex: 5 }}>
        scroll เพื่อซูม · ลากเพื่อเลื่อน
      </div>
    )}

    <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "4px", zIndex: 10 }}>
      <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.5))} style={{ width: "32px", height: "32px", background: "rgba(10,10,10,0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "18px", borderRadius: "6px" }}>+</button>
      <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.5))} style={{ width: "32px", height: "32px", background: "rgba(10,10,10,0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "18px", borderRadius: "6px" }}>-</button>
    </div>
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
    {[
      { label: "พิกเซลที่ขาย", value: totalSold.toLocaleString() },
      { label: "พิกเซลว่าง", value: (TOTAL_PIXELS - totalSold).toLocaleString() },
      { label: "ยอดรวม", value: "฿" + totalSold.toLocaleString() },
      { label: "เต็มแล้ว", value: pct + "%" },
    ].map((s, i) => (
      <div key={s.label} style={{ padding: "16px 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none", textAlign: "center" }}>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>{s.value}</div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginTop: "3px", fontFamily: "Sarabun" }}>{s.label}</div>
      </div>
    ))}
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", maxWidth: "1400px", margin: "0 auto", background: "#0d0d0d" }}>
    <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[{ key: "leaderboard", label: "🏆 ลีดเดอร์บอร์ด" }, { key: "feed", label: "⚡ ล่าสุด" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: activeTab === t.key ? "2px solid #fff" : "2px solid transparent", color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.3)", fontSize: "12px", fontWeight: 600, letterSpacing: "1px", fontFamily: "Sarabun", marginBottom: "-1px" }}>{t.label}</button>
        ))}
      </div>

      {activeTab === "leaderboard" && (
        <div>
          {leaderboard.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "Sarabun", fontSize: "13px" }}>ยังไม่มีผู้ซื้อ — เป็นคนแรกเลย! 🏆</div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.04)" }}>
                {leaderboard.slice(0, 3).map((item, i) => (
                  <div key={item.name} style={{ padding: "20px 12px", background: "#0d0d0d", textAlign: "center", borderBottom: "2px solid " + (i === 0 ? "#fff" : i === 1 ? "#888" : "#444") }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{["🥇","🥈","🥉"][i]}</div>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: i === 0 ? "#fff" : i === 1 ? "#666" : "#333", margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: i === 0 ? "#000" : "#fff" }}>{item.name.substring(0, 2).toUpperCase()}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#fff", marginBottom: "3px", fontFamily: "Sarabun" }}>{item.name}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{"฿" + item.pixels.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {leaderboard.slice(3).map((item, i) => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", minWidth: "18px", fontWeight: 600 }}>{"#" + (i + 4)}</div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "Sarabun" }}>{item.name}</div>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{"฿" + item.pixels.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: "18px 20px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button onClick={() => setMode("draw")} style={{ padding: "10px 24px", background: "#fff", border: "none", color: "#000", fontSize: "12px", fontWeight: 700, fontFamily: "Sarabun" }}>
              ✏️ วาดพิกเซลเพื่อขึ้น leaderboard
            </button>
          </div>
        </div>
      )}

      {activeTab === "feed" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4caf50", animation: "pulse 2s infinite" }} />
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "3px" }}>LIVE</div>
          </div>
          {blocks.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "Sarabun", fontSize: "13px" }}>ยังไม่มีการซื้อ</div>
          ) : (
            [...blocks].reverse().slice(0, 10).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "10px", height: "10px", background: item.color, flexShrink: 0 }} />
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "Sarabun" }}>{item.owner}</div>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{"฿" + (item.w * item.h).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>

    <div style={{ padding: "28px 24px" }}>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: "8px", fontFamily: "Sarabun" }}>
        8 ล้านพิกเซล<br />พิกเซลละ <span style={{ color: "#e63946" }}>1 บาท</span>
      </div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.8, marginBottom: "28px", fontFamily: "Sarabun", fontWeight: 300 }}>
        เมื่อขายครบ — บิลบอร์ดนี้จะขึ้นจริง<br />ใจกลางกรุงเทพมหานคร
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "3px", color: "rgba(255,255,255,0.2)", marginBottom: "14px" }}>วิธีซื้อพิกเซล</div>
        {[
          { n: "01", t: "กด เริ่มวาด", d: "กดปุ่มด้านบนขวา แล้ว zoom เข้าไปในพื้นที่ว่าง" },
          { n: "02", t: "วาดด้วยนิ้ว", d: "วาดรูป ชื่อ หรือโลโก้ของคุณลงบน billboard" },
          { n: "03", t: "กดซื้อ", d: "ระบบคำนวณราคาให้อัตโนมัติ ฿1/พิกเซล" },
          { n: "04", t: "โอนเงิน", d: "โอน Bank Transfer ตามข้อมูลบัญชีที่ปรากฏ" },
        ].map(s => (
          <div key={s.n} style={{ display: "flex", gap: "14px", marginBottom: "14px" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: 600, minWidth: "22px", marginTop: "2px" }}>{s.n}</div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", marginBottom: "2px", fontFamily: "Sarabun" }}>{s.t}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: "1.5", fontFamily: "Sarabun" }}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
        <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "3px", color: "rgba(255,255,255,0.2)", marginBottom: "10px" }}>ราคา</div>
        {[
          { px: "1,000", label: "เล็ก" },
          { px: "10,000", label: "กลาง" },
          { px: "100,000", label: "ใหญ่" },
          { px: "1,000,000", label: "ยักษ์ 👑" },
        ].map(p => (
          <div key={p.px} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontFamily: "Sarabun" }}>{p.px + " px · " + p.label}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>{"฿" + p.px}</div>
          </div>
        ))}
      </div>
    </div>
  </div>

  {toast && (
    <div style={{ position: "fixed", bottom: "28px", left: "50%", background: "#fff", padding: "12px 24px", fontSize: "13px", color: "#000", zIndex: 2000, animation: "fadeUp 0.3s ease", whiteSpace: "nowrap", fontFamily: "Sarabun", fontWeight: 600 }}>
      {toast}
    </div>
  )}

  {showModal && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", padding: "36px", width: "420px", maxWidth: "92vw" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "4px", letterSpacing: "1px" }}>จองพิกเซลของคุณ</div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "28px", fontFamily: "Sarabun" }}>
          {pendingPrice.toLocaleString() + " พิกเซล · ถาวรตลอดไป · ขึ้น Leaderboard"}
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: "6px" }}>ชื่อ / แบรนด์</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="นิรนาม" style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Sarabun", fontSize: "14px", outline: "none" }} />
        </div>
        <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "3px", marginBottom: "4px" }}>ยอดที่ต้องโอน</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#fff" }}>{"฿" + pendingPrice.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "10px", color: "rgba(255,255,255,0.2)", lineHeight: "1.8", fontFamily: "Sarabun" }}>
            <div>{pendingPrice.toLocaleString() + " พิกเซล"}</div>
            <div>{"@ ฿1/พิกเซล"}</div>
            <div style={{ color: "#fff", fontWeight: 600, marginTop: "4px" }}>+ ขึ้น Leaderboard 🏆</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: "1.8", marginBottom: "20px", fontFamily: "Sarabun" }}>
          โอนเงินมาที่บัญชี<br />
          ธนาคาร: <strong style={{ color: "#fff" }}>ธนาคารไทยพาณิชย์</strong><br />
          ชื่อบัญชี: <strong style={{ color: "#fff" }}>นายต้นกล้า ไปเยอซ์</strong><br />
          เลขบัญชี: <strong style={{ color: "#fff" }}>936-240-5487</strong>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "13px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", fontSize: "12px", fontFamily: "Sarabun" }}>ยกเลิก</button>
          <button onClick={handleBuy} style={{ flex: 2, padding: "13px", background: "#fff", border: "none", color: "#000", fontSize: "13px", fontWeight: 700, fontFamily: "Sarabun" }}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )}
</div>
```

);
}
