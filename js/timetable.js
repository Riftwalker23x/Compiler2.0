/* Timetable, room, and clock logic */
function onBlockChange(){
  const block=document.getElementById('r-block').value;
  const floorSel=document.getElementById('r-floor');
  const daySel=document.getElementById('r-day-sel');
  document.getElementById('sb2').className='step-box'+(block?' active-step':'');
  document.getElementById('sb3').className='step-box';
  document.getElementById('rooms-result').innerHTML='';
  floorSel.innerHTML='<option value="">-- Choose Floor --</option>';
  daySel.innerHTML='<option value="">-- Choose Floor First --</option>';
  daySel.disabled=true;
  if(!block){floorSel.disabled=true;return;}
  floorSel.disabled=false;
  Object.keys(BLOCK_FLOORS[block]).forEach(f=>{
    const opt=document.createElement('option');
    opt.value=f;
    opt.textContent=isNaN(f)?`${f} (Special)`:`Floor ${f}`;
    floorSel.appendChild(opt);
  });
}

function onFloorChange(){
  const block=document.getElementById('r-block').value;
  const floor=document.getElementById('r-floor').value;
  const daySel=document.getElementById('r-day-sel');
  document.getElementById('sb3').className='step-box'+(floor?' active-step':'');
  document.getElementById('rooms-result').innerHTML='';
  daySel.innerHTML='<option value="">-- Choose Day --</option>';
  if(!floor){daySel.disabled=true;return;}
  daySel.disabled=false;
  DAYS.forEach(d=>{
    const opt=document.createElement('option');
    opt.value=d;opt.textContent=d;
    daySel.appendChild(opt);
  });
  // Auto-select today if it's a weekday
  const todayName=DAYS[new Date().getDay()-1];
  if(todayName){daySel.value=todayName;onDayChange();}
}

function onDayChange(){
  const block=document.getElementById('r-block').value;
  const floor=document.getElementById('r-floor').value;
  const day=document.getElementById('r-day-sel').value;
  const res=document.getElementById('rooms-result');
  if(!block||!floor||!day){res.innerHTML='';return;}

  const allRooms=BLOCK_FLOORS[block][floor]||[];
  const upcomingSlots=getUpcomingSlots();
  const currentSlot=getCurrentSlot();

  if(!allRooms.length){
    res.innerHTML=`<div class="no-rooms"><span class="no-rooms-icon">&#9633;</span><div class="no-rooms-txt">NO ROOMS ON THIS FLOOR</div></div>`;
    return;
  }
  if(!upcomingSlots.length){
    res.innerHTML=`<div class="no-rooms"><span class="no-rooms-icon">&#9633;</span><div class="no-rooms-txt"><span class="blink">_</span> ALL SLOTS HAVE PASSED FOR TODAY<br>COME BACK TOMORROW</div></div>`;
    return;
  }

  // Build per-room data with current-slot status
  const roomData=allRooms.map(room=>{
    const slotInfo=getRoomSlotInfo(room,day);
    const currentEntry=currentSlot?slotInfo.find(s=>s.slot===currentSlot):null;
    const busyNow=currentEntry?currentEntry.occupiedBy:null;
    return{room,slotInfo,busyNow};
  });

  // Free-now rooms first, then busy-now
  roomData.sort((a,b)=>(!a.busyNow&&b.busyNow)?-1:(a.busyNow&&!b.busyNow)?1:0);

  const freeNowCount=roomData.filter(r=>!r.busyNow).length;

  const cards=roomData.map(({room,slotInfo,busyNow})=>{
    const cardClass=busyNow?'room-card busy-now':'room-card free-now';

    const statusBadge=busyNow
      ?`<span class="status-now busy" title="${busyNow.course} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${busyNow.dept} ${busyNow.batch}-${busyNow.section}">${busyNow.course}</span>`
      :`<span class="status-now free">FREE NOW</span>`;

    const slotsHTML=slotInfo.map(({slot,occupiedBy})=>{
      const isCurrent=slot===currentSlot;
      let dotClass,statusHTML,nowBadge='';
      if(isCurrent){
        dotClass=occupiedBy?'current-busy':'current-free';
        nowBadge=`<span class="now-badge${occupiedBy?' busy':''}">NOW</span>`;
      } else {
        dotClass=occupiedBy?'busy':'free';
      }
      statusHTML=occupiedBy
        ?`<span class="slot-status-busy" title="${occupiedBy.course} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${occupiedBy.dept} ${occupiedBy.batch}-${occupiedBy.section}">${occupiedBy.course}</span>`
        :`<span class="slot-status-free">FREE</span>`;
      return `<div class="slot-row${isCurrent?' is-current':''}">
        <div class="slot-dot ${dotClass}"></div>
        <span class="slot-time-lbl">${fmtSlot(slot)}</span>
        ${statusHTML}
        ${nowBadge}
      </div>`;
    }).join('');

    return `<div class="${cardClass}">
      <div class="room-card-head">
        <span class="room-card-name">${room}</span>
        ${statusBadge}
      </div>
      <div class="room-card-body">${slotsHTML}</div>
    </div>`;
  }).join('');

  const countClass=freeNowCount>0?'result-count green':'result-count red';
  res.innerHTML=`<div class="result-header">
    <span class="result-label">BLOCK ${block} &nbsp;&#9656;&nbsp; FLOOR ${floor} &nbsp;&#9656;&nbsp; ${day.toUpperCase()}</span>
    <span class="${countClass}">${freeNowCount}/${allRooms.length} FREE NOW</span>
  </div>
  <div class="rooms-grid">${cards}</div>`;
}

/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Tab switch ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */
function sw(i){
  ['nc0','nc1','nc2','nc3','nc4'].forEach((id,j)=>document.getElementById(id).className='nav-card'+(j===i?' active':''));
  ['p0','p1','p2','p3','p4'].forEach((id,j)=>document.getElementById(id).className='panel'+(j===i?' on':''));
  if(i===2) renderEvents();
  if(i===4) renderTodos();
}

/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Timetable panel ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */
function loadTT(){
  const dep=document.getElementById('dept').value;
  const bat=document.getElementById('batch').value;
  const sec=document.getElementById('sec').value;
  const day=document.getElementById('day').value;
  const data=(TT[dep]&&TT[dep][bat]&&TT[dep][bat][sec]&&TT[dep][bat][sec][day])||[];
  const out=document.getElementById('tt-out');
  if(!data.length){out.innerHTML='<div class="empty"><span class="blink">_</span> NO CLASSES SCHEDULED</div>';return;}
  out.innerHTML='<table class="tbl"><thead><tr><th style="width:52%">COURSE</th><th style="width:20%">ROOM</th><th style="width:28%">TIME</th></tr></thead><tbody>'+
    data.map(r=>`<tr><td>${r.c}</td><td>${r.l}</td><td>${fmtSlot(r.t)}</td></tr>`).join('')+'</tbody></table>';
}

/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Live clock + auto-refresh rooms when slot changes ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */
let _lastSlot=null;
function tickBanner(){
  const n=new Date();
  const t=n.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=DAYNAMES[n.getDay()];
  const dateStr=n.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const slot=getCurrentSlot();

  const hc=document.getElementById('clk');if(hc)hc.textContent=t;
  const hd=document.getElementById('clk-day');if(hd)hd.textContent=d+' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â '+dateStr;
  const rt=document.getElementById('r-time');if(rt)rt.textContent=t;
  const rd=document.getElementById('r-day-div');if(rd)rd.textContent=d+' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '+dateStr;
  const rs=document.getElementById('r-slot');if(rs)rs.textContent=slot?`CURRENT SLOT: ${fmtSlot(slot)}`:'NO ACTIVE SLOT RIGHT NOW';

  // Auto-refresh rooms view whenever the active slot changes
  if(slot!==_lastSlot){
    _lastSlot=slot;
    const p1=document.getElementById('p1');
    if(p1&&p1.classList.contains('on')){
      const daySel=document.getElementById('r-day-sel');
      if(daySel&&daySel.value) onDayChange();
    }
  }
}
setInterval(tickBanner,1000);
tickBanner();
