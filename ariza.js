// ariza.js – Arıza Modülü

let arBolum = 'alt';
let arMalzemelerAlt = [], arMalzemelerUst = [], arAdreslerAlt = [], arAdreslerUst = [], arKayitlar = [], arChips = [];

function arizaBaslat(){
  document.getElementById('ariza-form-area').innerHTML = '<div class="muted">Yükleniyor...</div>';
  const un1 = kol('malzemeler_alt').onSnapshot(s => { arMalzemelerAlt = s.docs.map(d => d.data().ad); if(arBolum==='alt') arizaFormCiz(); });
  const un2 = kol('malzemeler_ust').onSnapshot(s => { arMalzemelerUst = s.docs.map(d => d.data().ad); if(arBolum==='ust') arizaFormCiz(); });
  const un3 = kol('adresler_alt').onSnapshot(s => { arAdreslerAlt = s.docs.map(d => (d.data().mahalle || '') + ' ' + (d.data().adres || '')); });
  const un4 = kol('adresler_ust').onSnapshot(s => { arAdreslerUst = s.docs.map(d => (d.data().mahalle || '') + ' ' + (d.data().adres || '')); });
  const un5 = kol('ariza_kayitlari').onSnapshot(s => { arKayitlar = s.docs.map(d => ({id:d.id,...d.data()})); arizaListeleriCiz(); });
  window.aktifListeners.push(un1,un2,un3,un4,un5);
  arChips=[]; arizaFormCiz(); document.getElementById('ariza-ara').value=''; document.getElementById('ariza-ara-sonuc').innerHTML='';
}

function arizaFormCiz(){
  document.getElementById('ariza-form-area').innerHTML=`
    <div class="card"><h3>Yeni Arıza Kaydı</h3>
    <div class="flex gap-2 mb-3"><button class="bolge-btn ${arBolum==='alt'?'aktif':''}" onclick="arBolumSec('alt')">E5 Altı</button><button class="bolge-btn ${arBolum==='ust'?'aktif':''}" onclick="arBolumSec('ust')">E5 Üstü</button></div>
    <div class="grid3">
      <div class="suggest-wrap"><label class="f">Adres *</label><input id="ar-adres" autocomplete="off" oninput="arAdresOneriGoster()" onfocus="arAdresOneriGoster()"><div class="suggest-list" id="ar-adres-list"></div></div>
      <div class="suggest-wrap"><label class="f">Arızalı Parça Ekle *</label><input id="ar-parca" autocomplete="off" placeholder="Yazın, seçin ya da Enter'a basın" oninput="arParcaOneriGoster()" onfocus="arParcaOneriGoster()" onkeydown="arParcaKeydown(event)"><div class="suggest-list" id="ar-parca-list"></div></div>
      <div><label class="f">Hedef Tarih</label><input id="ar-hedef" type="date"></div>
      <div style="grid-column:1/-1"><label class="f">Eklenen Malzemeler ve Adetleri</label><div id="ar-parca-chips" class="mt-1"></div></div>
      <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="ar-aciklama"></div>
      <div><button class="btn btn-blue w-full" id="ar-btn-kaydet" onclick="arizaKaydet()">+ Kaydet</button></div>
    </div></div>`;
  arChipsCiz();
}

function arBolumSec(b){ arBolum=b; document.getElementById('ar-adres').value=''; document.getElementById('ar-parca').value=''; arizaFormCiz(); }

function arAdresOneriGoster(){
  const val=trLower(document.getElementById('ar-adres').value.trim());
  const all=arBolum==='alt'?arAdreslerAlt:arAdreslerUst;
  const m=val? all.filter(a=>trLower(a).indexOf(val)>-1) : all.slice(0,8);
  renderSuggest(document.getElementById('ar-adres-list'), m.slice(0,8), v=>{ document.getElementById('ar-adres').value=v; }, document.getElementById('ar-adres'));
}

function arParcaOneriGoster(){
  const val=trLower(document.getElementById('ar-parca').value.trim());
  const all=arBolum==='alt'?arMalzemelerAlt:arMalzemelerUst;
  const m=val? all.filter(a=>trLower(a).indexOf(val)>-1) : all.slice(0,8);
  renderSuggest(document.getElementById('ar-parca-list'), m.slice(0,8), v=>{ arChipEkle(v); }, document.getElementById('ar-parca'));
}

function arParcaKeydown(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('ar-parca-list').style.display='none'; arChipEkle(); } }

function arChipEkle(v){
  v = (v!=null? v : document.getElementById('ar-parca').value).trim();
  if(!v) return;
  v = formatText(v);
  if(arChips.some(x=>trLower(x.ad)===trLower(v))){ toast('Bu parça zaten eklendi'); return; }
  arChips.push({ad:v, adet:1});
  document.getElementById('ar-parca').value='';
  document.getElementById('ar-parca-list').style.display='none';
  arChipsCiz();
}

function arChipCikar(i){ arChips.splice(i,1); arChipsCiz(); }
function arChipAdetDegis(i, val){ arChips[i].adet = Math.max(1, Number(val)||1); }

function arChipsCiz(){
  const el = document.getElementById('ar-parca-chips'); if(!el) return;
  el.innerHTML = arChips.length ? arChips.map((p,i)=>`<span class="chip">${esc(p.ad)} <input class="adet-input" type="number" min="1" value="${p.adet}" onchange="arChipAdetDegis(${i}, this.value)"> <span class="x" onclick="arChipCikar(${i})">&times;</span></span>`).join('') : '<span class="text-xs text-gray-500">Henüz parça eklenmedi.</span>';
}

async function arizaKaydet(){
  const adres = formatText(document.getElementById('ar-adres').value);
  const hedef = document.getElementById('ar-hedef').value;
  const aciklama = formatText(document.getElementById('ar-aciklama').value);
  if(document.getElementById('ar-parca').value.trim()) arChipEkle();
  if(!adres || arChips.length===0) return toast('Adres ve en az bir parça girin');
  const n=nowTarih();
  await kol('ariza_kayitlari').add({
    tarih:n.display, tarihISO:n.iso, bolum:arBolum==='ust'?'E5 Üstü':'E5 Altı', adres, hedefTarih:hedef||'', aciklama,
    parcalar: arChips.map(c=>({ad:c.ad, adet:c.adet, tamam:false})), durum:'Açık', tamamlanmaTarihi:'', kullanici:kullaniciAdi()
  });
  document.getElementById('ar-adres').value=''; document.getElementById('ar-hedef').value=''; document.getElementById('ar-aciklama').value='';
  arChips=[]; arChipsCiz();
  toast('Arıza kaydedildi');
}

function arParcaAdlari(a){ return (a.parcalar||[]).map(p=>p.ad).join(', '); }

// "Malzeme (adet), Malzeme2 (adet2)" — genel adet yerine bunu her yerde kullanıyoruz
function arParcaAdetli(a){
  return (a.parcalar||[]).map(p=>`${p.ad} (${p.adet})`).join(', ') || '-';
}

function arizaListeleriCiz(){ arizaListeCiz('alt','ariza-list-alt'); arizaListeCiz('ust','ariza-list-ust'); }

function arizaListeCiz(b, elId){
  const el = document.getElementById(elId);
  const list = arKayitlar.filter(a=>a.bolum=== (b==='ust'?'E5 Üstü':'E5 Altı') && a.durum!=='Tamamlandı').sort((a,b2)=>trKarsilastir(b2.tarihISO, a.tarihISO));
  var html = list.map(a=>{
    const tamam = (a.parcalar||[]).filter(p=>p.tamam).length, toplam=(a.parcalar||[]).length;
    return `<div class="ariza-item" onclick="arizaDetayGoster('${a.id}')">
      <div class="font-bold text-sm">${esc(a.adres)} <span class="badge b-az">${tamam}/${toplam}</span></div>
      <div class="text-xs text-gray-400">${esc(arParcaAdetli(a))}${a.hedefTarih?(' · Hedef: '+esc(isoToDisplay(a.hedefTarih))):''}</div>
      <div class="text-right mt-1"><button class="icon-btn" onclick="event.stopPropagation();arizaDuzenle('${a.id}')"><i class="fa-solid fa-pen"></i></button> <button class="icon-btn" onclick="event.stopPropagation();arizaSil('${a.id}')"><i class="fa-solid fa-trash text-red-400"></i></button></div>
    </div>`;
  }).join('');
  el.innerHTML = html || '<div class="muted">Açık kayıt yok.</div>';
}

function arizaBul(id){ return arKayitlar.find(x=>x.id===id); }

function arizaDetayGoster(id){
  const a = arizaBul(id); if(!a) return;
  var parcaRows = (a.parcalar||[]).map((p,idx)=>`<label class="parca-check-row"><input type="checkbox" ${p.tamam?'checked':''} onchange="arParcaCheck('${id}',${idx},this.checked)"> ${esc(p.ad)} (${p.adet} adet)</label>`).join('');
  const yenidenAcBtn = a.durum === 'Tamamlandı'
    ? `<button class="btn btn-gray" onclick="arizaYenidenAc('${id}')"><i class="fa-solid fa-rotate-left"></i> Yeniden Aç</button>`
    : `<button class="btn btn-green" onclick="arizaTamamlandiYap('${id}')">Tamamlandı Olarak İşaretle</button>`;
  openModal('Arıza Detayı', `
    <div class="text-sm"><b>Adres:</b> ${esc(a.adres)}<br><b>Bölüm:</b> ${esc(a.bolum)}<br><b>Durum:</b> ${esc(a.durum)}</div>
    <div class="mt-2">${parcaRows}</div>
    <div class="flex justify-end gap-2 mt-4">
      ${yenidenAcBtn}
      <button class="btn btn-gray" onclick="closeModal()">Kapat</button>
    </div>
  `);
}

function arParcaCheck(id, idx, checked){
  const a = arizaBul(id); if(!a) return;
  a.parcalar[idx].tamam = checked;
  kol('ariza_kayitlari').doc(id).update({ parcalar: a.parcalar });
}

async function arizaTamamlandiYap(id){
  const a = arizaBul(id); if(!a) return;
  const tumuTamam = a.parcalar.every(p=>p.tamam);
  if(!tumuTamam) return toast('Tüm parçalar tamamlanmadan kapatamazsınız.');
  const n=nowTarih();
  await kol('ariza_kayitlari').doc(id).update({ durum:'Tamamlandı', tamamlanmaTarihi: n.display+' '+n.saat });
  closeModal();
  toast('Arıza tamamlandı olarak işaretlendi');
}

// YENİ: Tamamlanan bir arızayı yeniden aç — TÜM malzeme tikleri sıfırlanır (onaysız olur)
async function arizaYenidenAc(id){
  const a = arizaBul(id); if(!a) return;
  appConfirm('Bu arıza yeniden AÇIK duruma alınacak ve tüm malzeme tikleri sıfırlanacak (onaysız olacak). Onaylıyor musunuz?', async () => {
    const sifirlanmisParcalar = (a.parcalar||[]).map(p => ({ ad: p.ad, adet: p.adet, tamam: false }));
    await kol('ariza_kayitlari').doc(id).update({ durum: 'Açık', tamamlanmaTarihi: '', parcalar: sifirlanmisParcalar });
    closeModal();
    toast('Arıza yeniden açıldı');
  }, 'Yeniden Aç');
}

// ===================== ARIZA DÜZENLEME (malzeme + adet birlikte) =====================
let arDuzParcalar = []; // {ad, adet, tamam}
let arDuzId = null;

function arizaDuzenle(id){
  const a = arizaBul(id); if(!a) return;
  arDuzId = id;
  arDuzParcalar = (a.parcalar||[]).map(p=>({ ad: p.ad, adet: p.adet || 1, tamam: !!p.tamam }));
  openModal('Arıza Düzenle', `<div class="grid3">
    <div><label class="f">Adres</label><input id="ea2-adres" value="${esc(a.adres)}"></div>
    <div><label class="f">Hedef Tarih</label><input id="ea2-hedef" type="date" value="${esc(a.hedefTarih||'')}"></div>
    <div class="suggest-wrap" style="grid-column:1/-1"><label class="f">Malzeme Ekle</label><input id="ea2-parca-ekle" autocomplete="off" placeholder="Parça adı yazın, seçin ya da Enter'a basın" oninput="arDuzParcaOneriGoster()" onfocus="arDuzParcaOneriGoster()" onkeydown="arDuzParcaKeydown(event)"><div class="suggest-list" id="ea2-parca-list"></div></div>
    <div style="grid-column:1/-1"><label class="f">Malzemeler ve Adetleri</label><div id="ea2-parca-liste" class="mt-1"></div></div>
    <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="ea2-aciklama" value="${esc(a.aciklama||'')}"></div>
    <div><button class="btn btn-blue w-full mt-2" onclick="arizaGuncelle('${id}')">Güncelle</button></div>
  </div>`);
  arDuzParcaListesiCiz();
}

function arDuzParcaListesiCiz(){
  const el = document.getElementById('ea2-parca-liste'); if(!el) return;
  el.innerHTML = arDuzParcalar.length ? arDuzParcalar.map((p,i)=>`
    <div class="flex items-center gap-2 py-1" style="border-top:1px solid #1e293b">
      <span class="flex-1 text-xs">${esc(p.ad)} ${p.tamam?'<span class="badge b-ok">Tamam</span>':''}</span>
      <input type="number" min="1" value="${p.adet}" class="adet-input" style="width:60px;background:#0f172a;border:1px solid #334155;border-radius:4px;padding:2px 4px" onchange="arDuzAdetDegis(${i}, this.value)">
      <button class="icon-btn" onclick="arDuzParcaCikar(${i})"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('') : '<span class="text-xs text-gray-500">Malzeme eklenmedi.</span>';
}

function arDuzAdetDegis(i,val){ arDuzParcalar[i].adet = Math.max(1, Number(val)||1); }
function arDuzParcaCikar(i){ arDuzParcalar.splice(i,1); arDuzParcaListesiCiz(); }

function arDuzParcaOneriGoster(){
  const val = trLower(document.getElementById('ea2-parca-ekle').value.trim());
  const a = arizaBul(arDuzId);
  const all = (a && a.bolum==='E5 Üstü') ? arMalzemelerUst : arMalzemelerAlt;
  const m = val? all.filter(x=>trLower(x).indexOf(val)>-1) : all.slice(0,8);
  renderSuggest(document.getElementById('ea2-parca-list'), m.slice(0,8), v=>{ arDuzParcaEkle(v); }, document.getElementById('ea2-parca-ekle'));
}
function arDuzParcaKeydown(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('ea2-parca-list').style.display='none'; arDuzParcaEkle(); } }
function arDuzParcaEkle(v){
  v = (v!=null? v: document.getElementById('ea2-parca-ekle').value).trim();
  if(!v) return;
  v = formatText(v);
  if(arDuzParcalar.some(x=>trLower(x.ad)===trLower(v))){ toast('Bu parça zaten listede'); return; }
  arDuzParcalar.push({ad:v, adet:1, tamam:false});
  document.getElementById('ea2-parca-ekle').value='';
  document.getElementById('ea2-parca-list').style.display='none';
  arDuzParcaListesiCiz();
}

async function arizaGuncelle(id){
  const adres = formatText(document.getElementById('ea2-adres').value);
  const aciklama = formatText(document.getElementById('ea2-aciklama').value);
  const hedef = document.getElementById('ea2-hedef').value;
  if(document.getElementById('ea2-parca-ekle').value.trim()) arDuzParcaEkle();
  if(!adres || arDuzParcalar.length===0){ toast('Adres ve en az bir parça girin'); return; }
  const tumuTamam = arDuzParcalar.every(p=>p.tamam);
  const update = { adres, hedefTarih: hedef, aciklama, parcalar: arDuzParcalar, durum: tumuTamam ? 'Tamamlandı' : 'Açık' };
  if (tumuTamam) { const n = nowTarih(); update.tamamlanmaTarihi = n.display + ' ' + n.saat; }
  await kol('ariza_kayitlari').doc(id).set(update, {merge:true});
  closeModal(); toast('Güncellendi');
}

function arizaSil(id){ appConfirm('Bu arıza kaydını silmek istediğinizden emin misiniz?', async ()=>{ await kol('ariza_kayitlari').doc(id).delete(); toast('Kayıt silindi'); }); }

function onArizaAraInput(){
  const q = trLower(document.getElementById('ariza-ara').value.trim());
  const el = document.getElementById('ariza-ara-sonuc'); if(!q){ el.innerHTML=''; return; }
  const adresSet={}, parcaSet={};
  arKayitlar.forEach(a=>{ if(trLower(a.adres).indexOf(q)>-1) adresSet[a.adres]=true; (a.parcalar||[]).forEach(p=>{ if(trLower(p.ad).indexOf(q)>-1) parcaSet[p.ad]=true; }); });
  var html='';
  Object.keys(adresSet).forEach(a=> html+=`<div class="ariza-item" onclick="arizaAraDetay('adres','${esc(a).replace(/'/g,"\\'")}')"><i class="fa-solid fa-location-dot"></i> ${esc(a)}</div>`);
  Object.keys(parcaSet).forEach(p=> html+=`<div class="ariza-item" onclick="arizaAraDetay('parca','${esc(p).replace(/'/g,"\\'")}')"><i class="fa-solid fa-wrench"></i> ${esc(p)}</div>`);
  el.innerHTML = html || '<div class="muted">Sonuç yok.</div>';
}

function arizaAraDetay(tip, deger){
  const list = arKayitlar.filter(a => tip === 'adres' ? a.adres === deger : (a.parcalar || []).some(p => p.ad === deger))
    .sort((a, b) => trKarsilastir(b.tarihISO, a.tarihISO));
  let rows = list.map(a => {
    const badge = a.durum === 'Tamamlandı' ? '<span class="badge b-ok">Tamamlandı</span>' : '<span class="badge b-yok">Açık</span>';
    return `<tr><td>${esc(a.bolum)}</td><td>${esc(a.adres)}</td><td>${esc(arParcaAdetli(a))}</td><td>${badge}</td></tr>`;
  }).join('');
  openModal(deger, `<table><thead><tr><th>Bölüm</th><th>Adres</th><th>Malzemeler (Adet)</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok.</td></tr>'}</tbody></table>`);
}

function openArizaFiltrePopup(){
  const adrOpt = '<option value="">Tümü</option>' + uniq(arKayitlar.map(a => a.adres)).map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  const allParca = [];
  arKayitlar.forEach(a => (a.parcalar || []).forEach(p => allParca.push(p.ad)));
  const parOpt = '<option value="">Tümü</option>' + uniq(allParca).map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  openModal('Filtre (Tüm Kayıtlar)', `<div class="grid3">
    <div><label class="f">Adres</label><select id="fa-adres" onchange="arFiltreUygula()">${adrOpt}</select></div>
    <div><label class="f">Parça</label><select id="fa-parca" onchange="arFiltreUygula()">${parOpt}</select></div>
    <div><label class="f">Hedef (Başlangıç)</label><input id="fa-bas" type="date" onchange="arFiltreUygula()"></div>
    <div><label class="f">Hedef (Bitiş)</label><input id="fa-son" type="date" onchange="arFiltreUygula()"></div>
    <div><button class="btn btn-green w-full mt-4" onclick="arFiltreExcel()">Dışa Aktar</button></div></div>
    <div id="fa-sonuc" class="mt-3" style="overflow:auto"></div>`);
  arFiltreUygula();
}

function arFiltreListesi(){
  const adres = document.getElementById('fa-adres')?.value || '';
  const parca = document.getElementById('fa-parca')?.value || '';
  const bas = document.getElementById('fa-bas')?.value || '';
  const son = document.getElementById('fa-son')?.value || '';
  let l = arKayitlar.slice();
  if (adres) l = l.filter(a => a.adres === adres);
  if (parca) l = l.filter(a => (a.parcalar || []).some(p => p.ad === parca));
  if (bas) l = l.filter(a => (a.hedefTarih || '') >= bas);
  if (son) l = l.filter(a => (a.hedefTarih || '') <= son);
  return l;
}

function arFiltreUygula(){
  const l = arFiltreListesi().sort((a, b) => trKarsilastir(b.tarihISO, a.tarihISO));
  let rows = l.map(a => {
    const badge = a.durum === 'Tamamlandı' ? '<span class="badge b-ok">Tamamlandı</span>' : '<span class="badge b-yok">Açık</span>';
    return `<tr><td class="mono">${esc(a.tarih)}</td><td>${esc(a.bolum)}</td><td>${esc(a.adres)}</td><td>${esc(arParcaAdetli(a))}</td><td>${badge}</td></tr>`;
  }).join('');
  document.getElementById('fa-sonuc').innerHTML = `<table><thead><tr><th>Tarih</th><th>Bölüm</th><th>Adres</th><th>Malzemeler (Adet)</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Sonuç yok.</td></tr>'}</tbody></table>`;
}

function arFiltreExcel(){
  const l = arFiltreListesi();
  if (!l.length) return toast('Dışa aktarılacak kayıt yok');
  const rows = [['Tarih', 'Bölüm', 'Adres', 'Malzemeler (Adet)', 'Hedef', 'Açıklama', 'Durum']]
    .concat(l.map(a => [a.tarih, a.bolum, a.adres, arParcaAdetli(a), a.hedefTarih, a.aciklama, a.durum]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Ariza');
  XLSX.writeFile(wb, 'ariza_filtreli.xlsx');
}

function openArizaTamamlananlarPopup(){
  const l = arKayitlar.filter(a => a.durum === 'Tamamlandı')
    .sort((a, b) => trKarsilastir(b.tamamlanmaTarihi || '', a.tamamlanmaTarihi || ''));
  let rows = l.map(a => `<tr>
    <td class="mono">${esc(a.tamamlanmaTarihi || '-')}</td><td>${esc(a.bolum)}</td><td>${esc(a.adres)}</td><td>${esc(arParcaAdetli(a))}</td>
    <td class="text-right"><button class="btn btn-gray" onclick="closeModal();arizaYenidenAc('${a.id}')"><i class="fa-solid fa-rotate-left"></i> Yeniden Aç</button></td>
  </tr>`).join('');
  openModal('Tamamlanan Arızalar', `<table><thead><tr><th>Tamamlanma</th><th>Bölüm</th><th>Adres</th><th>Malzemeler (Adet)</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Kayıt yok.</td></tr>'}</tbody></table>`);
}
