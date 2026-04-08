import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jjfnyajgyzngvmpnrhbu.supabase.co";
const SUPABASE_KEY = "sb_publishable_hyUgnThgXkUiwNJ0VY1z_g_CbEUHSSf";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CANVAS_W = 1600;
const CANVAS_H = 500;
const TOTAL_PIXELS = 8000000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 40;

export default function App() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawColor, setDrawColor] = useState("#e63946");
  const [drawnPixels, setDrawnPixels] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPan, setLastPan] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "" });
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [mode, setMode] = useState("view");

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    loadPixels();
    const channel = supabase
      .channel("pixels")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pixels" },
        (payload) => {
          setBlocks((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const loadPixels = async () => {
    setLoading(true);
    const { data } = await supabase.from("pixels").select("*");
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

  const screenToCanvas = useCallback(
    (screenX, screenY) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      return {
        x: Math.floor((screenX - rect.left - pan.x) / zoom),
        y: Math.floor((screenY - rect.top - pan.y) / zoom),
      };
    },
    [pan, zoom]
  );

  const getClientPos = (e) => {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = "#f0ede8";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (zoom > 3) {
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth = 0.5 / zoom;
      for (let x = 0; x <= CANVAS_W; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_H; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }
    }

    blocks.forEach((b) => {
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

    drawnPixels.forEach((p) => {
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
  }, [blocks, drawnPixels, zoom, pan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }, []);

  useEffect(() => {
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
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
    setZoom((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta));
      setPan((p) => ({
        x: mouseX - (mouseX - p.x) * (newZoom / prev),
        y: mouseY - (mouseY - p.y) * (newZoom / prev),
      }));
      return newZoom;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const { x: cx, y: cy } = getClientPos(e);
      const pos = screenToCanvas(cx, cy);
      if (mode === "draw") {
        if (pos.x >= 0 && pos.x < CANVAS_W && pos.y >= 0 && pos.y < CANVAS_H) {
          setIsDrawing(true);
          setDrawnPixels((prev) => {
            if (prev.find((p) => p.x === pos.x && p.y === pos.y)) return prev;
            return [...prev, { x: pos.x, y: pos.y, color: drawColor }];
          });
        }
      } else {
        setIsPanning(true);
        setLastPan({ x: cx, y: cy });
      }
    },
    [mode, screenToCanvas, drawColor]
  );

  const onPointerMove = useCallback(
    (e) => {
      e.preventDefault();
      const { x: cx, y: cy } = getClientPos(e);
      if (mode === "draw" && isDrawing) {
        const pos = screenToCanvas(cx, cy);
        if (pos.x >= 0 && pos.x < CANVAS_W && pos.y >= 0 && pos.y < CANVAS_H) {
          setDrawnPixels((prev) => {
            if (prev.find((p) => p.x === pos.x && p.y === pos.y)) return prev;
            return [...prev, { x: pos.x, y: pos.y, color: drawColor }];
          });
        }
      } else if (isPanning && lastPan) {
        const dx = cx - lastPan.x;
        const dy = cy - lastPan.y;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        setLastPan({ x: cx, y: cy });
      }
    },
    [mode, isDrawing, isPanning, lastPan, screenToCanvas, drawColor]
  );

  const onPointerUp = useCallback(() => {
    if (isDrawing) {
      setHistory((prev) => [...prev, drawnPixels]);
      setRedoStack([]);
    }
    setIsDrawing(false);
    setIsPanning(false);
    setLastPan(null);
  }, [isDrawing, drawnPixels]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, drawnPixels]);
    setDrawnPixels(prev);
    setHistory((h) => h.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, drawnPixels]);
    setDrawnPixels(next);
    setRedoStack((r) => r.slice(0, -1));
  };

  const handleClearAll = () => {
    setHistory((h) => [...h, drawnPixels]);
    setRedoStack([]);
    setDrawnPixels([]);
  };

  const handleBuy = async () => {
    if (drawnPixels.length === 0) return;
    const xs = drawnPixels.map((p) => p.x);
    const ys = drawnPixels.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x + 1;
    const h = Math.max(...ys) - y + 1;
    const nb = { x, y, w, h, color: drawColor, owner: form.name || "ไม่ระบุ" };
    const { error } = await supabase.from("pixels").insert([nb]);
    if (error) {
      setToast("เกิดข้อผิดพลาด");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setDrawnPixels([]);
    setHistory([]);
    setRedoStack([]);
    setShowModal(false);
    setMode("view");
    setToast("บันทึกแล้ว!");
    setForm({ name: "" });
    setTimeout(() => setToast(""), 4000);
  };

  const pendingPrice = drawnPixels.length;

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; transition: all 0.15s; }
        button:hover { opacity: 0.8; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) translateX(-50%); } to { opacity:1; transform:translateY(0) translateX(-50%); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>

      {/* HEADER */}
      <header style={{ padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "4px", color: "#fff" }}>8MILBILLBOARD</div>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>8,000,000 PIXELS · BANGKOK</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>RAISED</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{"฿" + totalSold.toLocaleString()}</div>
          </div>
          {mode === "view" ? (
            <button
              onClick={() => setMode("draw")}
              style={{ padding: "10px 20px", background: "#e63946", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px" }}
            >
              ✏️ เริ่มวาด
            </button>
          ) : (
            <button
              onClick={() => { setMode("view"); setDrawnPixels([]); }}
              style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px" }}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div style={{ height: "2px", background: "rgba(255,255,255,0.05)" }}>
        <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg, #e63946, #ff6b6b)", transition: "width 0.5s" }} />
      </div>

      {/* CANVAS AREA */}
      <div style={{ position: "relative", height: "70vh", overflow: "hidden" }}>
        {/* Bangkok skyline background */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 60%, #2d2d5e 100%)" }}>
          <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", bottom: 0, width: "100%", opacity: 0.4 }}>
            <path d="M0,400 L0,280 L30,280 L30,240 L50,240 L50,220 L70,220 L70,200 L90,200 L90,180 L110,180 L110,160 L130,160 L130,140 L150,140 L150,160 L170,160 L170,180 L190,180 L190,200 L210,200 L210,240 L230,240 L230,260 L260,260 L260,220 L280,220 L280,200 L300,200 L300,180 L320,180 L320,160 L340,160 L340,140 L360,140 L360,120 L380,120 L380,100 L400,100 L400,120 L420,120 L420,140 L440,140 L440,160 L460,160 L460,180 L480,180 L480,200 L500,200 L500,240 L520,240 L520,260 L550,260 L550,230 L570,230 L570,210 L590,210 L590,190 L610,190 L610,170 L630,170 L630,150 L650,150 L650,130 L670,130 L670,110 L690,110 L690,90 L710,90 L710,70 L730,70 L730,90 L750,90 L750,110 L770,110 L770,130 L790,130 L790,150 L810,150 L810,170 L830,170 L830,190 L850,190 L850,230 L870,230 L870,260 L900,260 L900,220 L920,220 L920,200 L940,200 L940,180 L960,180 L960,160 L980,160 L980,140 L1000,140 L1000,160 L1020,160 L1020,180 L1040,180 L1040,200 L1060,200 L1060,240 L1080,240 L1080,260 L1110,260 L1110,230 L1130,230 L1130,210 L1150,210 L1150,190 L1170,190 L1170,170 L1190,170 L1190,190 L1210,190 L1210,210 L1230,210 L1230,240 L1260,240 L1260,260 L1290,260 L1290,280 L1320,280 L1320,300 L1360,300 L1360,280 L1400,280 L1400,300 L1440,300 L1440,400 Z" fill="#1a1a3e" />
            <path d="M0,400 L0,320 L60,320 L60,300 L80,300 L80,280 L100,280 L100,260 L120,260 L120,280 L140,280 L140,300 L160,300 L160,320 L200,320 L200,300 L220,300 L220,280 L240,280 L240,260 L260,260 L260,300 L300,300 L300,320 L340,320 L340,300 L360,300 L360,280 L380,280 L380,260 L400,260 L400,280 L420,280 L420,300 L440,300 L440,320 L480,320 L480,300 L500,300 L500,280 L520,280 L520,300 L540,300 L540,320 L580,320 L580,300 L600,300 L600,280 L620,280 L620,260 L640,260 L640,280 L660,280 L660,300 L680,300 L680,320 L720,320 L720,300 L740,300 L740,280 L760,280 L760,300 L780,300 L780,320 L820,320 L820,300 L840,300 L840,280 L860,280 L860,260 L880,260 L880,280 L900,280 L900,300 L920,300 L920,320 L960,320 L960,300 L980,300 L980,280 L1000,280 L1000,300 L1020,300 L1020,320 L1060,320 L1060,300 L1080,300 L1080,280 L1100,280 L1100,260 L1120,260 L1120,280 L1140,280 L1140,300 L1160,300 L1160,320 L1200,320 L1200,300 L1220,300 L1220,280 L1240,280 L1240,300 L1260,300 L1260,320 L1300,320 L1300,300 L1320,300 L1320,320 L1360,320 L1360,300 L1400,300 L1400,320 L1440,320 L1440,400 Z" fill="#0d0d2e" />
          </svg>
        </div>

        {/* Canvas container */}
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, zIndex: 1, touchAction: "none", cursor: mode === "draw" ? "crosshair" : "grab" }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        >
          <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {/* Draw toolbar */}
        {mode === "draw" && (
          <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.85)", padding: "10px 16px", borderRadius: "40px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", animation: "fadeUp 0.2s ease" }}>
            <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} style={{ width: "32px", height: "32px", border: "none", background: "none", cursor: "pointer", borderRadius: "50%" }} />
            <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />
            <button onClick={handleUndo} disabled={history.length === 0} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", opacity: history.length === 0 ? 0.3 : 1 }}>↩</button>
            <button onClick={handleRedo} disabled={redoStack.length === 0} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", opacity: redoStack.length === 0 ? 0.3 : 1 }}>↪</button>
            <button onClick={handleClearAll} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px" }}>🗑</button>
            <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }} />
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontFamily: "Sarabun, sans-serif" }}>
              {drawnPixels.length.toLocaleString()} px = <strong style={{ color: "#fff" }}>{"฿" + drawnPixels.length.toLocaleString()}</strong>
            </div>
            <button
              onClick={() => { if (drawnPixels.length > 0) setShowModal(true); }}
              style={{ padding: "8px 18px", background: "#e63946", color: "#fff", border: "none", borderRadius: "20px", fontWeight: 700, fontSize: "12px", opacity: drawnPixels.length === 0 ? 0.4 : 1 }}
            >
              ซื้อเลย
            </button>
          </div>
        )}

        {/* View hint */}
        {mode === "view" && !loading && (
          <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", fontSize: "11px", color: "rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.5)", padding: "6px 14px", borderRadius: "20px", whiteSpace: "nowrap" }}>
            scroll เพื่อซูม &nbsp;·&nbsp; ลากเพื่อเลื่อน
          </div>
        )}

        {/* Zoom buttons */}
        <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "6px" }}>
          <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))} style={{ width: "36px", height: "36px", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#fff", fontSize: "18px" }}>+</button>
          <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5))} style={{ width: "36px", height: "36px", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#fff", fontSize: "18px" }}>-</button>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#111", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { label: "พิกเซลที่ขาย", value: totalSold.toLocaleString() },
          { label: "พิกเซลว่าง", value: (TOTAL_PIXELS - totalSold).toLocaleString() },
          { label: "ยอดรวม", value: "฿" + totalSold.toLocaleString() },
          { label: "เต็มแล้ว", value: pct + "%" },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: "16px 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>{s.value}</div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginTop: "2px" }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* BOTTOM SECTION */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", maxWidth: "1400px", margin: "0 auto" }}>
        {/* LEFT: leaderboard / feed */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[{ key: "leaderboard", label: "🏆 ลีดเดอร์บอร์ด" }, { key: "feed", label: "⚡ ฟีด" }].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{ flex: 1, padding: "14px", background: "none", border: "none", color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.3)", borderBottom: activeTab === t.key ? "2px solid #e63946" : "2px solid transparent", fontWeight: 600, fontSize: "12px", letterSpacing: "1px" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "leaderboard" && (
            <div>
              {leaderboard.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>ยังไม่มีข้อมูล</div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.04)", margin: "16px" }}>
                    {leaderboard.slice(0, 3).map((item, i) => (
                      <div key={item.name} style={{ padding: "20px 12px", background: "#0d0d0d", textAlign: "center" }}>
                        <div style={{ fontSize: "20px", marginBottom: "6px" }}>{["🥇", "🥈", "🥉"][i]}</div>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e63946", margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>{item.name[0]}</div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>{item.name.substring(0, 10)}</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{"฿" + item.pixels.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                  {leaderboard.slice(3).map((item, i) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", minWidth: "20px" }}>#{i + 4}</div>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>{item.name}</div>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{"฿" + item.pixels.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: "18px 20px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  onClick={() => setMode("draw")}
                  style={{ padding: "10px 24px", background: "rgba(230,57,70,0.15)", color: "#e63946", border: "1px solid rgba(230,57,70,0.3)", borderRadius: "6px", fontWeight: 600, fontSize: "12px" }}
                >
                  ✏️ วาดพิกเซลเพื่อขึ้น leaderboard
                </button>
              </div>
            </div>
          )}

          {activeTab === "feed" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>LIVE FEED</div>
              </div>
              {blocks.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>ยังไม่มีกิจกรรม</div>
              ) : (
                [...blocks].reverse().slice(0, 10).map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "10px", height: "10px", background: item.color, flexShrink: 0, borderRadius: "2px" }} />
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{item.owner}</div>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{"฿" + (item.w * item.h).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT: info panel */}
        <div style={{ padding: "28px 24px" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: "10px" }}>
            8 ล้านพิกเซล<br />พิกเซลละ <span style={{ color: "#e63946" }}>1 บาท</span>
          </div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.8, marginBottom: "24px" }}>
            เมื่อขายครบ — บิลบอร์ดนี้จะขึ้นจริง<br />ใจกลางกรุงเทพมหานคร
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", marginBottom: "24px" }}>
            <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "3px", color: "rgba(255,255,255,0.2)", marginBottom: "16px" }}>วิธีซื้อ</div>
            {[
              { n: "01", t: "กด เริ่มวาด", d: "กดปุ่มด้านบนขวา แล้ว zoom เข้าไปในพื้นที่ว่าง" },
              { n: "02", t: "วาดด้วยนิ้ว", d: "วาดรูป ชื่อ หรือโลโก้ของคุณลงบน billboard" },
              { n: "03", t: "กดซื้อ", d: "ระบบคำนวณราคาให้อัตโนมัติ ฿1/พิกเซล" },
              { n: "04", t: "โอนเงิน", d: "โอน Bank Transfer ตามข้อมูลบัญชีที่ปรากฏ" },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", gap: "14px", marginBottom: "14px" }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: 600, minWidth: "20px", paddingTop: "2px" }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", marginBottom: "2px" }}>{s.t}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
            <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "3px", color: "rgba(255,255,255,0.2)", marginBottom: "12px" }}>ตัวอย่างราคา</div>
            {[
              { px: "1,000", label: "เล็ก" },
              { px: "10,000", label: "กลาง" },
              { px: "100,000", label: "ใหญ่" },
              { px: "1,000,000", label: "ยักษ์ 🔥" },
            ].map((p) => (
              <div key={p.px} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{p.px} px · {p.label}</div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>{"฿" + p.px}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: "28px", left: "50%", background: "#fff", padding: "12px 24px", borderRadius: "40px", color: "#000", fontWeight: 600, fontSize: "13px", animation: "fadeUp 0.2s ease", zIndex: 1000 }}>
          {toast}
        </div>
      )}

      {/* BUY MODAL */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "20px" }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "420px" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>ยืนยันการซื้อ</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "28px" }}>
              {pendingPrice.toLocaleString() + " พิกเซล · ถาวรตลอดไป · ขึ้น Leaderboard"}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: "8px" }}>ชื่อที่แสดงบน billboard</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ชื่อ / แบรนด์ / IG ของคุณ"
                style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" }}
              />
            </div>

            <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>ยอดชำระ</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#fff" }}>{"฿" + pendingPrice.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.8 }}>
                <div>{pendingPrice.toLocaleString() + " พิกเซล"}</div>
                <div>@ ฿1/พิกเซล</div>
                <div style={{ color: "#fff", fontWeight: 600, marginTop: "4px" }}>+ ขึ้น Leaderboard</div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, borderRadius: "8px", marginBottom: "20px" }}>
              โอนเงินมาที่บัญชี<br />
              ธนาคาร: <strong style={{ color: "#fff" }}>ธนาคารไทยพาณิชย์</strong><br />
              ชื่อบัญชี: <strong style={{ color: "#fff" }}>นายต้นกล้า ไปเยอซ์</strong><br />
              เลขบัญชี: <strong style={{ color: "#fff" }}>936-240-5487</strong>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontWeight: 600, fontSize: "13px" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleBuy}
                style={{ flex: 2, padding: "13px", background: "#e63946", border: "none", borderRadius: "8px", color: "#fff", fontWeight: 700, fontSize: "13px" }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
