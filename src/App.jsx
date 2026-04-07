import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jjfnyajgyzngvmpnrhbu.supabase.co";
const SUPABASE_KEY = "sb_publishable_hyUgnThgXkUiwNJ0VY1z_g_CbEUHSSf";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CANVAS_W = 1600;
const CANVAS_H = 500;
const TOTAL_PIXELS = 8000000;

function getNormSel(s, e) {
  if (!s || !e) return null;
  return { x:Math.min(s.x,e.x), y:Math.min(s.y,e.y), w:Math.abs(e.x-s.x), h:Math.abs(e.y-s.y) };
}

function getAvailPx(blocks, sel) {
  if (!sel) return 0;
  let sold = 0;
  blocks.forEach(b => {
    const ox = Math.max(sel.x,b.x), oy = Math.max(sel.y,b.y);
    const ow = Math.min(sel.x+sel.w,b.x+b.w)-ox;
    const oh = Math.min(sel.y+sel.h,b.y+b.h)-oy;
    if (ow>0&&oh>0) sold += ow*oh;
  });
  return Math.max(0,(sel.w*sel.h)-sold);
}

export default function App() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('draw');
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [confirmedSel, setConfirmedSel] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [uploadedImg, setUploadedImg] = useState(null);
  const [imgPos, setImgPos] = useState(null);
  const [isDraggingImg, setIsDraggingImg] = useState(false);
  const [dragOffset, setDragOffset] = useState(null);
  const [imgScale, setImgScale] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', color:'#333333' });
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [drawPixels, setDrawPixels] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#222222');
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    loadPixels();
    const channel = supabase
      .channel('pixels')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pixels' }, payload => {
        setBlocks(prev => [...prev, payload.new]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const loadPixels = async () => {
    setLoading(true);
    const { data } = await supabase.from('pixels').select('*');
    if (data) setBlocks(data);
    setLoading(false);
  };

  const totalSold = blocks.reduce((s,b)=>s+b.w*b.h,0);
  const pct = ((totalSold/TOTAL_PIXELS)*100).toFixed(3);

  const leaderboard = Object.values(
    blocks.reduce((acc,b)=>{
      if(!acc[b.owner]) acc[b.owner]={name:b.owner,pixels:0};
      acc[b.owner].pixels+=b.w*b.h; return acc;
    },{})
  ).sort((a,b)=>b.pixels-a.pixels);

  const getPos = useCallback((e)=>{
    const c=canvasRef.current; if(!c) return {x:0,y:0};
    const r=c.getBoundingClientRect();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    return {
      x:Math.max(0,Math.min(CANVAS_W-1,Math.floor((cx-r.left)*(CANVAS_W/r.width)))),
      y:Math.max(0,Math.min(CANVAS_H-1,Math.floor((cy-r.top)*(CANVAS_H/r.height))))
    };
  },[]);

  const draw = useCallback(()=>{
    const c=canvasRef.current; if(!c) return;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#f8f8f8'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=0.5;
    for(let x=0;x<=CANVAS_W;x+=10){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CANVAS_H);ctx.stroke();}
    for(let y=0;y<=CANVAS_H;y+=10){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CANVAS_W,y);ctx.stroke();}
    if(mode==='upload'&&uploadedImg&&imgPos){ctx.globalAlpha=0.95;ctx.drawImage(uploadedImg,imgPos.x,imgPos.y,imgPos.w,imgPos.h);ctx.globalAlpha=1;}
    blocks.forEach(b=>{
      ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,b.w,b.h);
      if(b.w>60&&b.h>18){
        ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(b.x+2,b.y+b.h/2-8,b.w-4,16);
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.font=`bold ${Math.min(10,b.h*0.2)}px sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(b.owner.substring(0,14),b.x+b.w/2,b.y+b.h/2);
      }
    });
    if(mode==='draw'&&drawPixels.length>0){ctx.fillStyle=drawColor;drawPixels.forEach(p=>ctx.fillRect(p.x,p.y,2,2));}
    const dragSel=getNormSel(startPos,currentPos);
    if(dragSel&&dragSel.w>2&&dragSel.h>2&&mode!=='draw'){
      ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
      ctx.strokeRect(dragSel.x,dragSel.y,dragSel.w,dragSel.h);ctx.setLineDash([]);
      ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(dragSel.x,dragSel.y,dragSel.w,dragSel.h);
      const px=dragSel.w*dragSel.h;
      const label=`${px.toLocaleString()} px = ฿${px.toLocaleString()}`;
      ctx.font='bold 11px monospace';const tw=ctx.measureText(label).width;
      let lx=dragSel.x+4,ly=dragSel.y-20;if(ly<4)ly=dragSel.y+6;if(lx+tw+12>CANVAS_W)lx=CANVAS_W-tw-16;
      ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(lx-4,ly-2,tw+12,17);
      ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(label,lx,ly);
    }
    if(confirmedSel&&mode!=='draw'){ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.setLineDash([]);ctx.strokeRect(confirmedSel.x,confirmedSel.y,confirmedSel.w,confirmedSel.h);}
    if(hoverPos&&!isSelecting&&!isDrawing){
      ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=0.5;ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(hoverPos.x,0);ctx.lineTo(hoverPos.x,CANVAS_H);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,hoverPos.y);ctx.lineTo(CANVAS_W,hoverPos.y);ctx.stroke();
    }
  },[blocks,startPos,currentPos,hoverPos,isSelecting,confirmedSel,uploadedImg,imgPos,mode,drawPixels,drawColor,isDrawing]);

  useEffect(()=>{
    const loop=()=>{draw();animRef.current=requestAnimationFrame(loop);};
    animRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animRef.current);
  },[draw]);

  const onDown=(e)=>{
    e.preventDefault();const p=getPos(e);
    if(mode==='draw'){setIsDrawing(true);setDrawPixels(prev=>[...prev,p]);return;}
    if(mode==='upload'&&imgPos&&p.x>=imgPos.x&&p.x<=imgPos.x+imgPos.w&&p.y>=imgPos.y&&p.y<=imgPos.y+imgPos.h){
      setIsDraggingImg(true);setDragOffset({dx:p.x-imgPos.x,dy:p.y-imgPos.y});return;
    }
    setIsSelecting(true);setStartPos(p);setCurrentPos(p);
  };

  const onMove=(e)=>{
    e.preventDefault();const p=getPos(e);setHoverPos(p);
    if(mode==='draw'&&isDrawing){setDrawPixels(prev=>[...prev,p]);return;}
    if(isDraggingImg&&imgPos&&dragOffset){
      setImgPos(prev=>({...prev,x:Math.max(0,Math.min(CANVAS_W-prev.w,p.x-dragOffset.dx)),y:Math.max(0,Math.min(CANVAS_H-prev.h,p.y-dragOffset.dy))}));return;
    }
    if(isSelecting)setCurrentPos(p);
  };

  const onUp=(e)=>{
    e.preventDefault();
    if(mode==='draw'){setIsDrawing(false);return;}
    if(isDraggingImg){setIsDraggingImg(false);setDragOffset(null);return;}
    if(!isSelecting)return;
    const p=getPos(e);const sel=getNormSel(startPos,p);
    if(sel&&sel.w>=10&&sel.h>=10){
      setConfirmedSel(sel);
      if(mode==='upload'&&uploadedImg){
        const aspect=uploadedImg.width/uploadedImg.height;const selAspect=sel.w/sel.h;
        let w=sel.w,h=sel.h;if(aspect>selAspect){h=w/aspect;}else{w=h*aspect;}
        setImgPos({x:sel.x+(sel.w-w)/2,y:sel.y+(sel.h-h)/2,w,h});setImgScale(1);
      }
    }
    setIsSelecting(false);setStartPos(null);setCurrentPos(null);
  };

  const onLeave=()=>{
    setHoverPos(null);
    if(isSelecting){setIsSelecting(false);setStartPos(null);setCurrentPos(null);}
    if(isDrawing)setIsDrawing(false);
    if(isDraggingImg){setIsDraggingImg(false);setDragOffset(null);}
  };

  const handleImageUpload=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const img=new Image();
    img.onload=()=>{
      setUploadedImg(img);
      const bx=200,by=150,bw=300,bh=180;
      setConfirmedSel({x:bx,y:by,w:bw,h:bh});
      const aspect=img.width/img.height;const sa=bw/bh;
      let w=bw,h=bh;if(aspect>sa){h=w/aspect;}else{w=h*aspect;}
      setImgPos({x:bx+(bw-w)/2,y:by+(bh-h)/2,w,h});setImgScale(1);
    };
    img.src=URL.createObjectURL(file);
  };

  const scaleImg=(delta)=>{
    if(!imgPos||!uploadedImg)return;
    const ns=Math.max(0.2,Math.min(5,imgScale+delta));
    const aspect=uploadedImg.width/uploadedImg.height;
    const bw=confirmedSel?confirmedSel.w:200,bh=confirmedSel?confirmedSel.h:150;
    const sa=bw/bh;let bwf=bw,bhf=bh;
    if(aspect>sa){bhf=bwf/aspect;}else{bwf=bhf*aspect;}
    const nw=bwf*ns,nh=bhf*ns;
    const cx=imgPos.x+imgPos.w/2,cy=imgPos.y+imgPos.h/2;
    setImgPos({x:cx-nw/2,y:cy-nh/2,w:nw,h:nh});setImgScale(ns);
  };

  const handleBuy=async()=>{
    let nb=null;
    if(mode==='draw'){
      if(drawPixels.length===0)return;
      const xs=drawPixels.map(p=>p.x),ys=drawPixels.map(p=>p.y);
      const x=Math.min(...xs),y=Math.min(...ys);
      nb={x,y,w:Math.max(Math.max(...xs)-x,1),h:Math.max(Math.max(...ys)-y,1),color:drawColor,owner:form.name||'นิรนาม'};
    } else if(mode==='upload'&&imgPos){
      nb={x:Math.round(imgPos.x),y:Math.round(imgPos.y),w:Math.round(imgPos.w),h:Math.round(imgPos.h),color:'#aaaaaa',owner:form.name||'นิรนาม'};
    }
    if(!nb)return;
    const{error}=await supabase.from('pixels').insert([nb]);
    if(error){setToast('เกิดข้อผิดพลาด กรุณาลองใหม่');setTimeout(()=>setToast(''),3000);return;}
    setDrawPixels([]);setImgPos(null);setUploadedImg(null);setConfirmedSel(null);
    setShowModal(false);setToast(`✓ "${form.name||'นิรนาม'}" ติดบิลบอร์ดแล้ว!`);
    setForm({name:'',color:'#333333'});setTimeout(()=>setToast(''),4000);
  };

  const drawPx=drawPixels.length;
  const upAvail=imgPos?getAvailPx(blocks,{x:Math.round(imgPos.x),y:Math.round(imgPos.y),w:Math.round(imgPos.w),h:Math.round(imgPos.h)}):0;
  const pendingPrice=mode==='draw'?drawPx:upAvail;
  const inp={width:'100%',padding:'11px 14px',background:'#f5f5f5',border:'1px solid #ddd',color:'#111',fontFamily:'inherit',fontSize:'14px',outline:'none'};

  return(
    <div style={{background:'#fff',minHeight:'100vh',color:'#111',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Sarabun:wght@300;400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#ccc;}
        button{cursor:pointer;transition:all 0.15s;} button:hover{opacity:0.75;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <header style={{padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #ebebeb',background:'#fff',position:'sticky',top:0,zIndex:100}}>
        <div>
          <div style={{fontSize:'15px',fontWeight:700,letterSpacing:'3px',color:'#111'}}>8MILBILLBOARD</div>
          <div style={{fontSize:'10px',color:'#aaa',letterSpacing:'2px',marginTop:'2px',fontFamily:'Sarabun'}}>8,000,000 พิกเซล · ฿1/พิกเซล · กรุงเทพมหานคร</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'24px'}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'10px',color:'#aaa',letterSpacing:'2px'}}>ยอดขายรวม</div>
            <div style={{fontSize:'20px',fontWeight:700,color:'#111'}}>฿{totalSold.toLocaleString()}</div>
          </div>
          <button onClick={()=>setShowModal(true)} style={{padding:'11px 24px',background:'#111',border:'none',color:'#fff',fontSize:'13px',fontWeight:600,letterSpacing:'1px'}}>ซื้อพิกเซล</button>
        </div>
      </header>

      <div style={{height:'2px',background:'#f0f0f0'}}><div style={{height:'100%',width:`${pct}%`,background:'#111',minWidth:'2px',transition:'width 0.8s'}}/></div>

      <div style={{padding:'0',background:'#111',position:'relative'}}>
        <div style={{position:'absolute',top:'12px',left:'16px',zIndex:10,display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#fff',opacity:0.4,animation:'pulse 2s infinite'}}/>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.35)',letterSpacing:'3px'}}>LIVE · BANGKOK BILLBOARD</div>
        </div>
        <div style={{position:'absolute',top:'10px',right:'16px',zIndex:10,display:'flex',gap:'4px'}}>
          {[{key:'draw',label:'🎨 วาด'},{key:'upload',label:'📁 อัปโหลด'}].map(m=>(
            <button key={m.key} onClick={()=>setMode(m.key)} style={{padding:'6px 14px',background:mode===m.key?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.1)',border:'none',color:mode===m.key?'#111':'rgba(255,255,255,0.6)',fontSize:'11px',fontWeight:600,fontFamily:'Sarabun'}}>{m.label}</button>
          ))}
        </div>
        {loading&&(<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20,background:'rgba(0,0,0,0.5)'}}><div style={{width:'32px',height:'32px',border:'3px solid rgba(255,255,255,0.2)',borderTop:'3px solid #fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>)}
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{display:'block',width:'100%',height:'auto',userSelect:'none',cursor:mode==='draw'?'crosshair':'default'}} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave}/>
        {mode==='draw'&&(<div style={{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:'12px',background:'rgba(255,255,255,0.95)',padding:'10px 20px',border:'1px solid rgba(0,0,0,0.08)'}}>
          <div style={{fontSize:'11px',color:'#555',fontFamily:'Sarabun'}}>สี</div>
          <input type="color" value={drawColor} onChange={e=>setDrawColor(e.target.value)} style={{width:'32px',height:'32px',border:'1px solid #ddd',padding:'2px',cursor:'pointer',background:'none'}}/>
          <div style={{width:'1px',height:'24px',background:'#eee'}}/>
          <div style={{fontSize:'11px',color:'#555',fontFamily:'Sarabun'}}>{drawPx.toLocaleString()} px = <strong>฿{drawPx.toLocaleString()}</strong></div>
          <button onClick={()=>setDrawPixels([])} style={{fontSize:'11px',color:'#999',background:'none',border:'none',fontFamily:'Sarabun'}}>ลบ</button>
          <button onClick={()=>{if(drawPx>0)setShowModal(true);}} style={{padding:'7px 18px',background:'#111',border:'none',color:'#fff',fontSize:'11px',fontWeight:600,fontFamily:'Sarabun'}}>ซื้อ ฿{drawPx.toLocaleString()} →</button>
        </div>)}
        {mode==='upload'&&(<div style={{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:'12px',background:'rgba(255,255,255,0.95)',padding:'10px 20px',border:'1px solid rgba(0,0,0,0.08)'}}>
          {!uploadedImg?(<><div style={{fontSize:'11px',color:'#555',fontFamily:'Sarabun'}}>เลือกพื้นที่แล้วอัปโหลดโลโก้</div><button onClick={()=>fileRef.current?.click()} style={{padding:'7px 18px',background:'#111',border:'none',color:'#fff',fontSize:'11px',fontWeight:600,fontFamily:'Sarabun'}}>อัปโหลดโลโก้</button><input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload}/></>
          ):(<>
            <div style={{fontSize:'11px',color:'#555',fontFamily:'Sarabun'}}>ขนาด</div>
            <button onClick={()=>scaleImg(-0.1)} style={{width:'30px',height:'30px',background:'#f5f5f5',border:'1px solid #ddd',fontSize:'16px',color:'#333'}}>−</button>
            <div style={{fontSize:'11px',fontWeight:600,minWidth:'36px',textAlign:'center'}}>{Math.round(imgScale*100)}%</div>
            <button onClick={()=>scaleImg(0.1)} style={{width:'30px',height:'30px',background:'#f5f5f5',border:'1px solid #ddd',fontSize:'16px',color:'#333'}}>+</button>
            <div style={{width:'1px',height:'24px',background:'#eee'}}/>
            <div style={{fontSize:'11px',color:'#555',fontFamily:'Sarabun'}}>{upAvail.toLocaleString()} px = <strong>฿{upAvail.toLocaleString()}</strong></div>
            <button onClick={()=>{setUploadedImg(null);setImgPos(null);setConfirmedSel(null);}} style={{fontSize:'11px',color:'#999',background:'none',border:'none',fontFamily:'Sarabun'}}>ลบ</button>
            <button onClick={()=>{if(upAvail>0)setShowModal(true);}} style={{padding:'7px 18px',background:'#111',border:'none',color:'#fff',fontSize:'11px',fontWeight:600,fontFamily:'Sarabun'}}>ซื้อ ฿{upAvail.toLocaleString()} →</button>
          </>)}
        </div>)}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid #ebebeb'}}>
        {[{label:'พิกเซลที่ขายไปแล้ว',value:totalSold.toLocaleString()},{label:'พิกเซลที่เหลืออยู่',value:(TOTAL_PIXELS-totalSold).toLocaleString()},{label:'ยอดเงินรวม',value:`฿${totalSold.toLocaleString()}`},{label:'ขายไปแล้ว',value:`${pct}%`}].map((s,i)=>(
          <div key={s.label} style={{padding:'20px 24px',borderRight:i<3?'1px solid #ebebeb':'none',textAlign:'center'}}>
            <div style={{fontSize:'22px',fontWeight:700,color:'#111'}}>{s.value}</div>
            <div style={{fontSize:'10px',color:'#aaa',letterSpacing:'2px',marginTop:'4px',fontFamily:'Sarabun'}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',maxWidth:'1400px',margin:'0 auto'}}>
        <div style={{borderRight:'1px solid #ebebeb'}}>
          <div style={{display:'flex',borderBottom:'1px solid #ebebeb'}}>
            {[{key:'leaderboard',label:'🏆 ลีดเดอร์บอร์ด'},{key:'feed',label:'⚡ ล่าสุด'}].map(t=>(
              <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{flex:1,padding:'16px',background:'none',border:'none',borderBottom:activeTab===t.key?'2px solid #111':'2px solid transparent',color:activeTab===t.key?'#111':'#aaa',fontSize:'12px',fontWeight:600,letterSpacing:'1px',fontFamily:'Sarabun',marginBottom:'-1px'}}>{t.label}</button>
            ))}
          </div>
          {activeTab==='leaderboard'&&(<div>
            {leaderboard.length===0?(<div style={{padding:'40px',textAlign:'center',color:'#ccc',fontFamily:'Sarabun',fontSize:'13px'}}>ยังไม่มีผู้ซื้อ — เป็นคนแรกเลย! 🏆</div>):(<>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1px',background:'#ebebeb'}}>
                {leaderboard.slice(0,3).map((item,i)=>(
                  <div key={item.name} style={{padding:'24px 16px',background:'#fff',textAlign:'center',borderBottom:`3px solid ${i===0?'#111':i===1?'#888':'#bbb'}`}}>
                    <div style={{fontSize:'22px',marginBottom:'8px'}}>{'🥇🥈🥉'[i]}</div>
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:i===0?'#111':i===1?'#666':'#aaa',margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:'#fff'}}>{item.name.substring(0,2).toUpperCase()}</div>
                    <div style={{fontSize:'12px',fontWeight:700,color:'#111',marginBottom:'4px',fontFamily:'Sarabun'}}>{item.name}</div>
                    <div style={{fontSize:'16px',fontWeight:700,color:'#111'}}>฿{item.pixels.toLocaleString()}</div>
                    <div style={{fontSize:'9px',color:'#bbb',marginTop:'2px',fontFamily:'Sarabun'}}>{item.pixels.toLocaleString()} พิกเซล</div>
                  </div>
                ))}
              </div>
              {leaderboard.slice(3).map((item,i)=>(
                <div key={item.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 24px',borderBottom:'1px solid #f5f5f5'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                    <div style={{fontSize:'12px',color:'#ccc',minWidth:'20px',fontWeight:600}}>#{i+4}</div>
                    <div style={{fontSize:'13px',fontWeight:500,color:'#333',fontFamily:'Sarabun'}}>{item.name}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'13px',fontWeight:700,color:'#111'}}>฿{item.pixels.toLocaleString()}</div>
                    <div style={{fontSize:'9px',color:'#ccc'}}>{item.pixels.toLocaleString()} px</div>
                  </div>
                </div>
              ))}
            </>)}
            <div style={{padding:'20px 24px',textAlign:'center',borderTop:'1px solid #f5f5f5'}}>
              <button onClick={()=>setShowModal(true)} style={{padding:'10px 24px',background:'#111',border:'none',color:'#fff',fontSize:'12px',fontWeight:600,fontFamily:'Sarabun'}}>ซื้อพิกเซลเพื่อขึ้น leaderboard →</button>
            </div>
          </div>)}
          {activeTab==='feed'&&(<div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'16px 24px',borderBottom:'1px solid #f5f5f5'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#111',animation:'pulse 2s infinite'}}/>
              <div style={{fontSize:'10px',color:'#aaa',letterSpacing:'3px'}}>LIVE</div>
            </div>
            {blocks.length===0?(<div style={{padding:'40px',textAlign:'center',color:'#ccc',fontFamily:'Sarabun',fontSize:'13px'}}>ยังไม่มีการซื้อ</div>):(
              [...blocks].reverse().slice(0,10).map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 24px',borderBottom:'1px solid #f5f5f5'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'10px',height:'10px',background:item.color,flexShrink:0}}/>
                    <div style={{fontSize:'13px',fontWeight:600,color:'#111',fontFamily:'Sarabun'}}>{item.owner}</div>
                  </div>
                  <div style={{fontSize:'13px',fontWeight:700,color:'#111'}}>฿{(item.w*item.h).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>)}
        </div>

        <div style={{padding:'32px'}}>
          <div style={{fontSize:'13px',color:'#aaa',lineHeight:'2',marginBottom:'32px',fontFamily:'Sarabun',fontWeight:300}}>
            "นี่คือบิลบอร์ด คุณสามารถทิ้งร่องรอยของคุณได้ในราคาเพียง <span style={{color:'#111',fontWeight:700}}>฿1 ต่อพิกเซล</span> เมื่อขายครบ — ผมจะเอาบิลบอร์ดนี้ไปตั้งกลางกรุงเทพมหานคร"
          </div>
          <div style={{borderTop:'1px solid #ebebeb',paddingTop:'24px',marginBottom:'24px'}}>
            <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'3px',color:'#aaa',marginBottom:'16px'}}>วิธีซื้อพิกเซล</div>
            {[{n:'01',t:'เลือกโหมด',d:'วาดเองทีละพิกเซล หรืออัปโหลดโลโก้ของคุณ'},{n:'02',t:'วางบน Billboard',d:'ลากและเลือกพื้นที่ที่คุณต้องการ'},{n:'03',t:'โอนเงิน',d:'โอนผ่าน Bank Transfer แล้วส่งสลิปมาที่ LINE'},{n:'04',t:'ติดบิลบอร์ดตลอดไป',d:'ชื่อคุณขึ้น Leaderboard และอยู่บนบิลบอร์ดถาวร'}].map(s=>(
              <div key={s.n} style={{display:'flex',gap:'16px',marginBottom:'16px'}}>
                <div style={{fontSize:'10px',color:'#ccc',fontWeight:600,minWidth:'24px',marginTop:'2px'}}>{s.n}</div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'#111',marginBottom:'3px',fontFamily:'Sarabun'}}>{s.t}</div>
                  <div style={{fontSize:'11px',color:'#aaa',lineHeight:'1.6',fontFamily:'Sarabun'}}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid #ebebeb',paddingTop:'24px'}}>
            <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'3px',color:'#aaa',marginBottom:'12px'}}>ราคา</div>
            {[{px:'1,000',label:'เล็ก'},{px:'10,000',label:'กลาง'},{px:'100,000',label:'ใหญ่'},{px:'1,000,000',label:'ยักษ์ 👑'}].map(p=>(
              <div key={p.px} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #f5f5f5'}}>
                <div style={{fontSize:'12px',color:'#555',fontFamily:'Sarabun'}}>{p.px} พิกเซล <span style={{color:'#bbb'}}>· {p.label}</span></div>
                <div style={{fontSize:'12px',fontWeight:700,color:'#111'}}>฿{p.px}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast&&(<div style={{position:'fixed',bottom:'28px',left:'50%',background:'#111',padding:'12px 24px',fontSize:'13px',color:'#fff',zIndex:2000,animation:'fadeUp 0.3s ease',whiteSpace:'nowrap',fontFamily:'Sarabun'}}>{toast}</div>)}

      {showModal&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)'}}>
        <div style={{background:'#fff',padding:'40px',width:'420px',maxWidth:'92vw',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:'16px',fontWeight:700,color:'#111',marginBottom:'4px',letterSpacing:'1px'}}>จองพิกเซลของคุณ</div>
          <div style={{fontSize:'11px',color:'#aaa',marginBottom:'28px',fontFamily:'Sarabun'}}>{pendingPrice.toLocaleString()} พิกเซล · ถาวรตลอดไป · ขึ้น Leaderboard</div>
          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'10px',fontWeight:600,color:'#aaa',letterSpacing:'2px',marginBottom:'6px'}}>ชื่อ / แบรนด์</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="นิรนาม" style={inp}/>
          </div>
          <div style={{padding:'16px',background:'#f8f8f8',border:'1px solid #ebebeb',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <div style={{fontSize:'9px',color:'#aaa',letterSpacing:'3px',marginBottom:'4px'}}>ยอดที่ต้องโอน</div>
              <div style={{fontSize:'28px',fontWeight:700,color:'#111'}}>฿{pendingPrice.toLocaleString()}</div>
            </div>
            <div style={{textAlign:'right',fontSize:'10px',color:'#bbb',lineHeight:'1.8',fontFamily:'Sarabun'}}>
              <div>{pendingPrice.toLocaleString()} พิกเซล</div>
              <div>@ ฿1/พิกเซล</div>
              <div style={{color:'#111',fontWeight:600,marginTop:'4px'}}>+ ขึ้น Leaderboard 🏆</div>
            </div>
          </div>
          <div style={{background:'#f8f8f8',padding:'14px',fontSize:'11px',color:'#888',lineHeight:'1.8',marginBottom:'20px',fontFamily:'Sarabun'}}>
            📱 โอนเงินมาที่บัญชี<br/>
            ธนาคาร: <strong style={{color:'#111'}}>ใส่ชื่อธนาคารของคุณ</strong><br/>
            ชื่อบัญชี: <strong style={{color:'#111'}}>ใส่ชื่อบัญชีของคุณ</strong><br/>
            เลขบัญชี: <strong style={{color:'#111'}}>ใส่เลขบัญชีของคุณ</strong><br/>
            ส่งสลิปมาที่ LINE: <strong style={{color:'#111'}}>@8milbillboard</strong>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <button onClick={()=>setShowModal(false)} style={{flex:1,padding:'13px',background:'none',border:'1px solid #ddd',color:'#aaa',fontSize:'12px',fontFamily:'Sarabun'}}>ยกเลิก</button>
            <button onClick={handleBuy} style={{flex:2,padding:'13px',background:'#111',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,fontFamily:'Sarabun'}}>ยืนยัน + ส่งสลิป →</button>
          </div>
        </div>
      </div>)}
    </div>
  );
}
