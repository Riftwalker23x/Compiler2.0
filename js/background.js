/* Background animation */
(function bg(){
  const cv=document.getElementById('bg3d'),ctx=cv.getContext('2d');
  function resize(){cv.width=cv.offsetWidth;cv.height=Math.max(cv.offsetHeight,760)}
  resize();window.addEventListener('resize',resize);
  const pts=Array.from({length:28},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.0005,vy:(Math.random()-.5)*.0005}));
  let t=0;
  function draw(){
    const W=cv.width,H=cv.height;
    ctx.fillStyle='#f0f7f0';ctx.fillRect(0,0,W,H);
    const pers=260,fov=0.5,camz=t*.00022;
    for(let i=0;i<=10;i++){
      const x=i/10;
      for(let d=0;d<2;d++){
        const z0=camz+d,z1=camz+d+1;
        ctx.strokeStyle=`rgba(0,140,70,${0.065*(1-Math.abs(x-.5)*1.4)})`;ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo((x-.5)*pers/(z0*fov)+W/2,(0-.5)*pers/(z0*fov)+H/2);ctx.lineTo((x-.5)*pers/(z1*fov)+W/2,(0-.5)*pers/(z1*fov)+H/2);ctx.stroke();
        ctx.beginPath();ctx.moveTo((x-.5)*pers/(z0*fov)+W/2,(1-.5)*pers/(z0*fov)+H/2);ctx.lineTo((x-.5)*pers/(z1*fov)+W/2,(1-.5)*pers/(z1*fov)+H/2);ctx.stroke();
        for(let j=0;j<=10;j++){const y=j/10;ctx.strokeStyle='rgba(0,140,70,0.05)';ctx.beginPath();ctx.moveTo((0-.5)*pers/(z0*fov)+W/2,(y-.5)*pers/(z0*fov)+H/2);ctx.lineTo((1-.5)*pers/(z0*fov)+W/2,(y-.5)*pers/(z0*fov)+H/2);ctx.stroke();}
      }
    }
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>1)p.vx*=-1;if(p.y<0||p.y>1)p.vy*=-1;
      ctx.beginPath();ctx.arc(p.x*W,p.y*H,1.4,0,Math.PI*2);ctx.fillStyle='rgba(0,140,70,0.15)';ctx.fill();
    });
    pts.forEach((a,i)=>pts.slice(i+1).forEach(b=>{
      const dx=(a.x-b.x)*W,dy=(a.y-b.y)*H,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<72){ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.strokeStyle=`rgba(0,140,70,${0.07*(1-dist/72)})`;ctx.lineWidth=.5;ctx.stroke();}
    }));
    t++;requestAnimationFrame(draw);
  }
  draw();
})();
