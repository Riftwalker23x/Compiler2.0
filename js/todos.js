/* To-do list */
let _todos=[];
let _todoFilter='all';

function todoLoad(){
  try{const s=localStorage.getItem('fast_todos');if(s)_todos=JSON.parse(s);}catch(e){_todos=[];}
}
function todoSave(){
  try{localStorage.setItem('fast_todos',JSON.stringify(_todos));}catch(e){}
}

function addTodo(){
  const inp=document.getElementById('todo-input');
  const pri=document.getElementById('todo-priority').value;
  const text=inp.value.trim();
  if(!text) return;
  const now=new Date();
  _todos.unshift({
    id:Date.now(),
    text,
    priority:pri,
    done:false,
    created:now.toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'})
  });
  todoSave();
  inp.value='';
  inp.focus();
  renderTodos();
}

function toggleTodo(id){
  const t=_todos.find(x=>x.id===id);
  if(t) t.done=!t.done;
  todoSave();
  renderTodos();
}

function deleteTodo(id){
  _todos=_todos.filter(x=>x.id!==id);
  todoSave();
  renderTodos();
}

function clearDone(){
  _todos=_todos.filter(x=>!x.done);
  todoSave();
  renderTodos();
}

function setTodoFilter(f){
  _todoFilter=f;
  ['all','active','done','high','medium','low'].forEach(k=>{
    const el=document.getElementById('tf-'+k);
    if(el) el.className='todo-filter-btn'+(k===f?' active':'');
  });
  renderTodos();
}

function renderTodos(){
  todoLoad();
  const total=_todos.length;
  const doneCount=_todos.filter(x=>x.done).length;
  document.getElementById('todo-stats').textContent=`${total-doneCount} ACTIVE ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${doneCount} DONE`;

  let visible=_todos;
  if(_todoFilter==='active') visible=_todos.filter(x=>!x.done);
  else if(_todoFilter==='done') visible=_todos.filter(x=>x.done);
  else if(['high','medium','low'].includes(_todoFilter)) visible=_todos.filter(x=>x.priority===_todoFilter);

  const list=document.getElementById('todo-list');
  if(!visible.length){
    const msgs={all:'NO TASKS YET ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ADD ONE ABOVE',active:'NO ACTIVE TASKS',done:'NO COMPLETED TASKS',high:'NO HIGH PRIORITY TASKS',medium:'NO MEDIUM PRIORITY TASKS',low:'NO LOW PRIORITY TASKS'};
    list.innerHTML=`<div class="todo-empty"><span class="todo-empty-icon">&#9998;</span><div class="todo-empty-txt">${msgs[_todoFilter]||'NO TASKS'}</div></div>`;
    return;
  }

  // Sort: undone first within same priority, then by priority weight, then by id desc
  const pw={high:0,medium:1,low:2};
  visible=[...visible].sort((a,b)=>{
    if(a.done!==b.done) return a.done?1:-1;
    if(pw[a.priority]!==pw[b.priority]) return pw[a.priority]-pw[b.priority];
    return b.id-a.id;
  });

  const priLabel={high:'HIGH',medium:'MEDIUM',low:'LOW'};
  list.innerHTML=visible.map(t=>`
    <div class="todo-item${t.done?' done':''}" id="ti-${t.id}">
      <div class="todo-check${t.done?' checked':''}" onclick="toggleTodo(${t.id})"></div>
      <div class="todo-item-body">
        <div class="todo-item-text">${escHtml(t.text)}</div>
        <div class="todo-item-meta">
          <span class="todo-priority-tag ${t.priority}">${priLabel[t.priority]}</span>
          <span class="todo-item-date">Added ${t.created}</span>
        </div>
      </div>
      <button class="todo-del-btn" onclick="deleteTodo(${t.id})" title="Delete">ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</button>
    </div>`).join('');
}

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// Init todos
todoLoad();
