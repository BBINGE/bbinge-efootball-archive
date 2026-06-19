(function(){
  'use strict';

  const SUPABASE_URL='https://grdcypicgtknhgrtmwnp.supabase.co';
  const SUPABASE_KEY='sb_publishable_7Bi-obrvmknad_tWyt02DQ_5fPtBGMJ';
  const TABLE='football_archives';
  const BUCKET='player-photos';
  let client=null;
  let currentUser=null;
  let cloudRevision=0;
  let ready=false;
  let saveTimer=null;
  let saving=false;
  let saveAgain=false;

  const el=id=>document.getElementById(id);
  const localPreview=()=>location.protocol==='file:';

  function setStatus(kind,label,title=''){
    const button=el('cloudStatus');
    if(!button)return;
    button.className=`button cloud-status ${kind}`;
    button.textContent=label;
    button.title=title||label;
  }

  function showLogin(message=''){
    ready=false;
    el('authGate')?.classList.remove('hidden');
    if(el('authMessage'))el('authMessage').textContent=message;
    setStatus('error','LOGIN','클라우드 로그인이 필요합니다.');
  }

  function hideLogin(){el('authGate')?.classList.add('hidden')}

  function cloudPayload(){
    const payload=structuredClone(db);
    payload.cards.forEach(card=>{
      if(card.photoPath)card.photo='';
    });
    return payload;
  }

  async function uploadPendingPhotos(){
    const pending=db.cards.filter(card=>typeof card.photo==='string'&&card.photo.startsWith('data:image/'));
    for(let index=0;index<pending.length;index++){
      const card=pending[index];
      setStatus('syncing',`PHOTO ${index+1}/${pending.length}`,'선수 사진을 안전한 저장소로 옮기는 중입니다.');
      const blob=await fetch(card.photo).then(response=>response.blob());
      const path=`${currentUser.id}/${card.id}.webp`;
      const {error}=await client.storage.from(BUCKET).upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'3600'});
      if(error)throw error;
      card.photoPath=path;
      card.photo='';
    }
    if(pending.length){
      await hydratePhotoUrls(db);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
      render();
    }
  }

  async function hydratePhotoUrls(target){
    const cards=target.cards.filter(card=>card.photoPath);
    await Promise.all(cards.map(async card=>{
      const {data,error}=await client.storage.from(BUCKET).createSignedUrl(card.photoPath,60*60*24*7);
      if(!error&&data?.signedUrl)card.photo=data.signedUrl;
    }));
  }

  async function loadCloudArchive(){
    setStatus('syncing','LOADING','클라우드 기록을 불러오는 중입니다.');
    const {data,error}=await client.from(TABLE).select('data, revision, updated_at').eq('user_id',currentUser.id).maybeSingle();
    if(error)throw error;
    if(!data){
      const summary=`현재 PC 기록: 선수 ${db.persons.length.toLocaleString()}명 · 카드 ${db.cards.length.toLocaleString()}장 · 리그 ${db.leagues.length.toLocaleString()}개 · 팀 ${db.clubs.length.toLocaleString()}개`;
      el('migrationSummary').textContent=summary;
      el('migrationMessage').textContent='';
      el('cloudMigrationDialog').showModal();
      setStatus('syncing','SETUP','최초 클라우드 업로드를 기다리고 있습니다.');
      return;
    }
    const next=data.data;
    if(!next?.persons||!next?.cards||!next?.clubs||!next?.leagues)throw new Error('클라우드 데이터 형식이 올바르지 않습니다.');
    await hydratePhotoUrls(next);
    db=next;
    cloudRevision=Number(data.revision)||1;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    ready=true;
    render();
    setStatus('synced','SYNCED',`클라우드 동기화 완료 · revision ${cloudRevision}`);
  }

  async function migrateLocalArchive(){
    const button=el('migrateLocalData');
    button.disabled=true;
    el('migrationMessage').textContent='기존 기록과 사진을 업로드하고 있습니다. 창을 닫지 마세요.';
    try{
      await uploadPendingPhotos();
      const {data,error}=await client.from(TABLE).insert({user_id:currentUser.id,data:cloudPayload()}).select('revision').single();
      if(error)throw error;
      cloudRevision=Number(data.revision)||1;
      ready=true;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
      el('cloudMigrationDialog').close();
      setStatus('synced','SYNCED',`최초 업로드 완료 · revision ${cloudRevision}`);
      toast('현재 PC 기록을 클라우드에 안전하게 복사했습니다.');
    }catch(error){
      el('migrationMessage').textContent=`업로드 실패: ${error.message}. 로컬 기록은 그대로 보존되어 있습니다.`;
      setStatus('error','ERROR','클라우드 최초 업로드에 실패했습니다.');
    }finally{button.disabled=false}
  }

  function scheduleSave(){
    if(!ready||!currentUser)return;
    clearTimeout(saveTimer);
    setStatus('syncing','SAVING','변경사항을 클라우드에 저장할 예정입니다.');
    saveTimer=setTimeout(saveNow,700);
  }

  async function saveNow(){
    if(!ready||!currentUser)return;
    if(saving){saveAgain=true;return}
    saving=true;
    try{
      await uploadPendingPhotos();
      const expectedRevision=cloudRevision;
      const {data,error}=await client.from(TABLE).update({data:cloudPayload()}).eq('user_id',currentUser.id).eq('revision',expectedRevision).select('revision, updated_at').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('다른 기기에서 먼저 수정되었습니다. 클라우드에서 다시 불러온 뒤 수정해 주세요.');
      cloudRevision=Number(data.revision)||expectedRevision+1;
      setStatus('synced','SYNCED',`클라우드 동기화 완료 · revision ${cloudRevision}`);
    }catch(error){
      setStatus('error','SYNC ERROR',error.message);
      toast(`클라우드 저장 실패: ${error.message}`);
    }finally{
      saving=false;
      if(saveAgain){saveAgain=false;scheduleSave()}
    }
  }

  async function handleSession(session){
    if(!session?.user){showLogin();return}
    currentUser=session.user;
    hideLogin();
    try{await loadCloudArchive()}catch(error){
      setStatus('error','ERROR',error.message);
      showLogin(`클라우드 연결 실패: ${error.message}`);
    }
  }

  async function signOut(){
    ready=false;
    currentUser=null;
    el('cloudMigrationDialog')?.close();
    el('cloudMenuDialog')?.close();
    await client.auth.signOut();
    showLogin('안전하게 로그아웃했습니다.');
  }

  async function init(){
    if(localPreview()){
      setStatus('','LOCAL','로컬 미리보기에서는 클라우드 연결을 사용하지 않습니다.');
      return;
    }
    if(!window.supabase?.createClient){showLogin('클라우드 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');return}
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    el('authForm').onsubmit=async event=>{
      event.preventDefault();
      const submit=event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled=true;
      el('authMessage').textContent='로그인 중...';
      const {data,error}=await client.auth.signInWithPassword({email:el('authEmail').value.trim(),password:el('authPassword').value});
      submit.disabled=false;
      if(error){el('authMessage').textContent='이메일 또는 비밀번호를 확인해 주세요.';return}
      el('authPassword').value='';
      await handleSession(data.session);
    };
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT')showLogin();
      if(event==='TOKEN_REFRESHED'&&session)currentUser=session.user;
    });
    const {data}=await client.auth.getSession();
    await handleSession(data.session);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    el('migrateLocalData').onclick=migrateLocalArchive;
    el('cloudSignOut').onclick=signOut;
    el('cloudLogout').onclick=signOut;
    el('cloudStatus').onclick=()=>{
      if(!currentUser){showLogin();return}
      el('cloudMenuTitle').textContent=ready?'클라우드 동기화됨':'클라우드 확인 필요';
      el('cloudMenuText').textContent=`${currentUser.email} · revision ${cloudRevision||'-'} · 로컬 백업도 함께 유지됩니다.`;
      el('cloudMenuDialog').showModal();
    };
    el('cloudReload').onclick=async()=>{
      if(!confirm('클라우드에 저장된 최신 기록으로 화면을 다시 불러올까요?'))return;
      el('cloudMenuDialog').close();
      try{await loadCloudArchive()}catch(error){setStatus('error','ERROR',error.message);toast(error.message)}
    };
    el('cloudMenuDialog').querySelector('.cloud-menu-close').onclick=()=>el('cloudMenuDialog').close();
  });

  window.FootballCloud={init,scheduleSave,saveNow,isReady:()=>ready,backupData:cloudPayload};
})();
