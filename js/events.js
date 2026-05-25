/* Coming events */
const EVENTS=[
  {
    title:"Compiler Hackathon 2026",type:"HACKATHON",
    date:new Date(new Date().getTime()+3*24*60*60*1000),
    venue:"D-Block Audi",price:"PKR 500",seats:80,
    highlights:["24-hour non-stop coding challenge","Cash prizes worth PKR 150,000","Industry mentors from leading tech firms","Free meals and refreshments throughout","Certificates for all participants"]
  },
  {
    title:"AI & ML Summit",type:"CONFERENCE",
    date:new Date(new Date().getTime()+7*24*60*60*1000),
    venue:"Main Auditorium",price:"PKR 300",seats:200,
    highlights:["Keynote by FAST alumnus ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Google AI researcher","Live demos of generative AI tools","Panel discussion on AI in Pakistan","Networking session with industry leaders","Best project showcase competition"]
  },
  {
    title:"Tech Startup Expo",type:"EXPO",
    date:new Date(new Date().getTime()+12*24*60*60*1000),
    venue:"Sports Complex Hall",price:"FREE",seats:500,
    highlights:["30+ student startup booths","Investor pitch competition ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â PKR 200K prize","Product demos open to public","Workshop: From Idea to MVP in 30 Days","Merchandise and giveaways"]
  },
  {
    title:"Cybersecurity CTF",type:"COMPETITION",
    date:new Date(new Date().getTime()+15*24*60*60*1000),
    venue:"C-Block Labs",price:"PKR 200",seats:60,
    highlights:["Capture The Flag challenge ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â 6 hours","Categories: Web, Crypto, Forensics, Reverse Eng.","Top team wins PKR 50,000","Open to all batches and departments","Team of 2ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ4 members per entry"]
  },
  {
    title:"Annual Compiler Dinner",type:"GALA",
    date:new Date(new Date().getTime()+20*24*60*60*1000),
    venue:"Marriott Hotel, ISB",price:"PKR 2,500",seats:150,
    highlights:["Formal dinner with faculty and alumni","Annual awards: Best Developer, Innovator of the Year","Live music and entertainment","Photo booth and memorabilia","Exclusive limited seating ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â book early"]
  },
  {
    title:"Open Source Workshop",type:"WORKSHOP",
    date:new Date(new Date().getTime()+25*24*60*60*1000),
    venue:"D-401",price:"PKR 100",seats:40,
    highlights:["Contributing to real GitHub projects","Git workflow and PR best practices","Getting started with open source maintainship","Hands-on session with Linux Foundation repos","Completion certificate provided"]
  }
];

function fmtEventDate(d){
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtEventShort(d){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
function daysFromNow(d){
  const diff=Math.ceil((d-new Date())/(1000*60*60*24));
  if(diff===0) return 'TODAY';
  if(diff===1) return 'TOMORROW';
  return `IN ${diff} DAYS`;
}

function typeClass(type){
  return({HACKATHON:'ev-hackathon',CONFERENCE:'ev-conference',EXPO:'ev-expo',COMPETITION:'ev-competition',GALA:'ev-gala',WORKSHOP:'ev-workshop'})[type]||'ev-workshop';
}

function renderEvents(){
  const now=new Date();
  const cutoff=new Date(now.getTime()+30*24*60*60*1000);
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  document.getElementById('ev-today-date').textContent=`${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const upcoming=EVENTS.filter(e=>e.date>=now&&e.date<=cutoff).sort((a,b)=>a.date-b.date);
  const grid=document.getElementById('events-grid');
  if(!upcoming.length){
    grid.innerHTML='<div class="no-events"><span style="font-family:VT323,monospace;font-size:48px;color:#b0d4b8;display:block;margin-bottom:8px">&#9670;</span>NO EVENTS IN THE NEXT 30 DAYS</div>';
    return;
  }
  grid.innerHTML=upcoming.map((ev,i)=>`
    <div class="ev-card ${typeClass(ev.type)}" onclick="openEvModal(${i})">
      <div class="ev-card-top">
        <div class="ev-card-date">${fmtEventShort(ev.date)} &nbsp;ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·&nbsp; ${daysFromNow(ev.date)}</div>
        <div class="ev-card-title">${ev.title}</div>
        <div class="ev-card-type">${ev.type}</div>
      </div>
      <div class="ev-card-body">
        <div class="ev-card-venue">&#9632; ${ev.venue}</div>
        <div class="ev-card-price">${ev.price}</div>
        <div class="ev-card-cta">TAP FOR DETAILS &amp; TICKETS &#9658;</div>
      </div>
    </div>`).join('');

  // store filtered list for modal access
  window._evList=upcoming;
}

function openEvModal(i){
  const ev=window._evList[i];
  const tc=typeClass(ev.type);
  document.getElementById('em-type').textContent=ev.type;
  document.getElementById('em-title').textContent=ev.title;
  document.getElementById('em-date').textContent=fmtEventDate(ev.date)+' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '+daysFromNow(ev.date);
  document.getElementById('em-venue').textContent=ev.venue;
  document.getElementById('em-price').textContent=ev.price;
  document.getElementById('em-seats').textContent=ev.seats;
  // Apply colour class to modal head
  const head=document.getElementById('ev-modal').querySelector('.ev-modal-head');
  head.className='ev-modal-head '+tc;
  // Colour info vals
  ['em-venue','em-price','em-seats'].forEach(id=>{
    const el=document.getElementById(id);
    el.className='ev-info-val '+tc;
  });
  document.getElementById('em-highlights').innerHTML=ev.highlights.map(h=>`<div class="ev-highlight-item"><div class="ev-highlight-dot ${tc}"></div><span>${h}</span></div>`).join('');
  document.getElementById('em-confirm').style.display='none';
  const btn=document.getElementById('em-buy-btn');
  btn.className='ev-buy-btn '+tc;
  btn.style.display='block';
  btn.textContent=ev.price==='FREE'?'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¶ REGISTER FREE':'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¶ BUY TICKET';
  document.getElementById('ev-overlay').style.display='flex';
}

function closeEvModal(e){if(e.target===document.getElementById('ev-overlay')) closeEvModalBtn();}
function closeEvModalBtn(){document.getElementById('ev-overlay').style.display='none';}

function buyTicket(){
  document.getElementById('em-buy-btn').style.display='none';
  document.getElementById('em-confirm').style.display='block';
}

