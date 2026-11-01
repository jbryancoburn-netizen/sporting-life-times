(()=>{'use strict';
const input=document.getElementById('epl-club-search'),directory=document.getElementById('epl-club-directory'),count=document.getElementById('epl-club-count');
if(!input||!directory)return;
const filter=()=>{const query=input.value.trim().toLocaleLowerCase();let matches=0;for(const card of directory.querySelectorAll('.slt-club-link')){card.hidden=!card.textContent.toLocaleLowerCase().includes(query);if(!card.hidden)matches++;}count.textContent=matches+' '+(matches===1?'club':'clubs');};
input.addEventListener('input',filter);new MutationObserver(filter).observe(directory,{childList:true});filter();
})();
