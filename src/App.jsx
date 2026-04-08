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
 const channel = supabase.channel("pixels")
 .on("postgres_changes", { event: "INSERT", schema: "public", table: "pixels" }, payload setBlocks(prev => [...prev, payload.new]);
 }).subscribe();
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
 container.addEventListener("wheel", handleWheel, { passive: false });
 return () => container.removeEventListener("wheel", handleWheel);
 }, [handleWheel]);
 const onPointerDown = useCallback((e) => {
 e.preventDefault();
 const { x: cx, y: cy } = getClientPos(e);
 const pos = screenToCanvas(cx, cy);
 if (mode === "draw") {
 if (pos.x >= 0 && pos.x < CANVAS_W && pos.y >= 0 && pos.y < CANVAS_H) {
 setIsDrawing(true);
 setDrawnPixels(prev => {
 if (prev.find(p => p.x === pos.x && p.y === pos.y)) return prev;
 return [...prev, { x: pos.x, y: pos.y, color: drawColor }];
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
 if (mode === "draw" && isDrawing) {
 const pos = screenToCanvas(cx, cy);
 if (pos.x >= 0 && pos.x < CANVAS_W && pos.y >= 0 && pos.y < CANVAS_H) {
 setDrawnPixels(prev => {
 if (prev.find(p => p.x === pos.x && p.y === pos.y)) return prev;
 return [...prev, { x: pos.x, y: pos.y, color: drawColor }];
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
 setHistory(prev => [...prev, drawnPixels]);
 setRedoStack([]);
 }
 setIsDrawing(false);
 setIsPanning(false);
 setLastPan(null);
 }, [isDrawing, drawnPixels]);
 const handleUndo = () => {
 if (history.length === 0) return;
 const prev = history[history.length - 1];
 setRedoStack(r => [...r, drawnPixels]);
 setDrawnPixels(prev);
 setHistory(h => h.slice(0, -1));
 };
 const handleRedo = () => {
 if (redoStack.length === 0) return;
 const next = redoStack[redoStack.length - 1];
 setHistory(h => [...h, drawnPixels]);
 setDrawnPixels(next);
 setRedoStack(r => r.slice(0, -1));
 };
 const handleClearAll = () => {
 setHistory(h => [...h, drawnPixels]);
 setRedoStack([]);
 setDrawnPixels([]);
 };
 const handleBuy = async () => {
 if (drawnPixels.length === 0) return;
 const xs = drawnPixels.map(p => p.x);
 const ys = drawnPixels.map(p => p.y);
 const x = Math.min(...xs);
 const y = Math.min(...ys);
 const w = Math.max(...xs) - x + 1;
 const h = Math.max(...ys) - y + 1;
 const nb = { x, y, w, h, color: drawColor, owner: form.name || "!รนาม" };
 const { error } = await supabase.from("pixels").insert([nb]);
 if (error) {
 setToast("เ'ด)อ+ดพลาด");
 setTimeout(() => setToast(""), 3000);
 return;
 }
 setDrawnPixels([]);
 setHistory([]);
 setRedoStack([]);
 setShowModal(false);
 setMode("view");
 setToast(".ด/ลบอ1ดแ3ว!");
 setForm({ name: "" });
 setTimeout(() => setToast(""), 4000);
 };
 const pendingPrice = drawnPixels.length;
 return (
 <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inte <style>{`
 @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700; * { box-sizing: border-box; margin: 0; padding: 0; }
 button { cursor: pointer; transition: all 0.15s; }
 button:hover { opacity: 0.8; }
 @keyframes fadeUp { from { opacity:0; transform:translateY(6px) translateX(-50%); } t @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
 @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
 `}</style>
 <header style={{ padding: "12px 24px", display: "flex", alignItems: "center", justifyCo <div>
 <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "4px", color: "#fff <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" </div>
 <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
 <div style={{ textAlign: "right" }}>
 <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2p <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{"฿" + totalSol </div>
 {mode === "view" ? (
 <button onClick={() => setMode("draw")} style={{ padding: "10px 20px", background เCมวาด
 </button>
 ) : (
 <button onClick={() => { setMode("view"); setDrawnPixels([]); }} style={{ padding ยกเDก
 </button>
 )}
 </div>
 </header>
 <div style={{ height: "2px", background: "rgba(255,255,255,0.05)" }}>
 <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg, # </div>
 <div style={{ position: "relative", height: "70vh", overflow: "hidden" }}>
 <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "linear-gradient <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax meet" style={{ position:  <path d="M0,400 L0,280 L30,280 L30,240 L50,240 L50,220 L70,220 L70,200 L90,200 L9 <path d="M0,400 L0,320 L60,320 L60,300 L80,300 L80,280 L100,280 L100,260 L120,260
 </svg>
 </div>
 <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 1, touchActi onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onM onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}>
 <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", hei </div>
 {loading && (
 <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignIte <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255, </div>
 )}
 {mode === "draw" && (
 <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "transl <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value) <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" } <button onClick={handleUndo} disabled={history.length === 0} style={{ width: "36p <button onClick={handleRedo} disabled={redoStack.length === 0} style={{ width: "3 <button onClick={handleClearAll} style={{ width: "36px", height: "36px", backgrou <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" } <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontFamily: "Sara {drawnPixels.length.toLocaleString()} px = <strong style={{ color: "#fff" }}>{" </div>
 <button onClick={() => { if (drawnPixels.length > 0) setShowModal(true); }} style Eอเลย
 </button>
 </div>
 )}
 {mode === "view" && !loading && (
 <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "transl scroll เFอGม · ลากเFอเHอน
 </div>
 )}
 <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.5))} style={{ width: " <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.5))} style={{ width: " </div>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#111" {[
 { label: "5กเซล;ขาย", value: totalSold.toLocaleString() },
 { label: "5กเซลIาง", value: (TOTAL_PIXELS - totalSold).toLocaleString() },
 { label: "ยอดรวม", value: "฿" + totalSold.toLocaleString() },
 { label: "เJมแ3ว", value: pct + "%" },
 ].map((s, i) => (
 <div key={s.label} style={{ padding: "16px 20px", borderRight: i < 3 ? "1px solid r <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>{s.value}</div>
 <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2p </div>
 ))}
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", maxWidth: "1400px", ma <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
 <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
 {[{ key: "leaderboard", label: " Kดเดอ1บอ1ด" }, { key: "feed", label: " Lา<ด"  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, paddi ))}
 </div>
 {activeTab === "leaderboard" && (
 <div>
 {leaderboard.length === 0 ? (
 <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255, ) : (
 <div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1p {leaderboard.slice(0, 3).map((item, i) => (
 <div key={item.name} style={{ padding: "20px 12px", background: "#0d0d0 <div style={{ fontSize: "20px", marginBottom: "6px" }}>{[" "," ","  <div style={{ width: "32px", height: "32px", borderRadius: "50%", bac <div style={{ fontSize: "11px", fontWeight: 700, color: "#fff", margi <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{"฿ </div>
 ))}
 </div>
 {leaderboard.slice(3).map((item, i) => (
 <div key={item.name} style={{ display: "flex", alignItems: "center", just <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
 <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", minWi <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255 </div>
 <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{"฿"  </div>
 ))}
 </div>
 )}
 <div style={{ padding: "18px 20px", textAlign: "center", borderTop: "1px solid
 <button onClick={() => setMode("draw")} style={{ padding: "10px 24px", backgr วาด5กเซลเFอTน leaderboard
 </button>
 </div>
 </div>
 )}
 {activeTab === "feed" && (
 <div>
 <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: " <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: </div>
 {blocks.length === 0 ? (
 <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255, ) : (
 [...blocks].reverse().slice(0, 10).map((item, i) => (
 <div key={i} style={{ display: "flex", alignItems: "center", justifyContent <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
 <div style={{ width: "10px", height: "10px", background: item.color, fl <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,2 </div>
 <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{"฿" +  </div>
 ))
 )}
 </div>
 )}
 </div>
 <div style={{ padding: "28px 24px" }}>
 <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.3, ma 8 3าน5กเซล<br />5กเซลละ <span style={{ color: "#e63946" }}>1 บาท</span>
 </div>
 <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.8, ma เVอขายครบ — /ลบอ1ดWจะTนจXง<br />ใจกลางก?งเทพมหานคร
 </div>
 <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", ma <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "3px", color: "rgb {[
 { n: "01", t: "กด เCมวาด", d: "กด[ม\านบนขวา แ3ว zoom เ)าไปใน^น;Iาง" },
 { n: "02", t: "วาด\วย_ว", d: "วาด`ป aอ หbอโลโdของeณลงบน billboard" },
 { n: "03", t: "กดEอ", d: "ระบบgนวณราคาใhiตโนk. ฿1/5กเซล" },
 { n: "04", t: "โอนเlน", d: "โอน Bank Transfer ตาม)อmลnญp;ปรากฏ" },
 ].map(s => (
 <div key={s.n} style={{ display: "flex", gap: "14px", marginBottom: "14px" }}>
 <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: 60
 <div>
 <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", marginBotto <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: </div>
 </div>
 ))}
 </div>
 <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
 <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "3px", color: "rgb {[
 { px: "1,000", label: "เrก" },
 { px: "10,000", label: "กลาง" },
 { px: "100,000", label: "ให:" },
 { px: "1,000,000", label: "Mกs " },
 ].map(p => (
 <div key={p.px} style={{ display: "flex", justifyContent: "space-between", padd <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontFamily: " <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>{"฿" + p.px </div>
 ))}
 </div>
 </div>
 </div>
 {toast && (
 <div style={{ position: "fixed", bottom: "28px", left: "50%", background: "#fff", pad {toast}
 </div>
 )}
 {showModal && (
 <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: " <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", paddin <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "4p <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "28 {pendingPrice.toLocaleString() + " 5กเซล · ถาวรตลอดไป · Tน Leaderboard"}
 </div>
 <div style={{ marginBottom: "16px" }}>
 <label style={{ display: "block", fontSize: "9px", fontWeight: 600, color: "rgb <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.va </div>
 <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.04)", border: <div>
 <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: <div style={{ fontSize: "28px", fontWeight: 700, color: "#fff" }}>{"฿" + pend </div>
 <div style={{ textAlign: "right", fontSize: "10px", color: "rgba(255,255,255,0.
 <div>{pendingPrice.toLocaleString() + " 5กเซล"}</div>
 <div>{"@ ฿1/5กเซล"}</div>
 <div style={{ color: "#fff", fontWeight: 600, marginTop: "4px" }}>+ Tน Leader </div>
 </div>
 <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", fontSize: "1 โอนเlนมา;nญp<br />
 ธนาคาร: <strong style={{ color: "#fff" }}>ธนาคารไทยพาxชz</strong><br />
 aอnญp: <strong style={{ color: "#fff" }}>นายvนก3า ไปเยอ{</strong><br />
 เลขnญp: <strong style={{ color: "#fff" }}>936-240-5487</strong>
 </div>
 <div style={{ display: "flex", gap: "10px" }}>
 <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "13px",  <button onClick={handleBuy} style={{ flex: 2, padding: "13px", background: "#ff |นMน
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
