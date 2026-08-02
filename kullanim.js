// kullanim.js
// Kullanım Girişi modülü

let kgBolum = null;
let kgMalzemeler = [];
let kgAdresler = [];
let kgKullanimlar = [];
let kgHareketler = [];
var kgMatQuery = '';
var kgAdrQuery = '';
var kgHareketBas = '';
var kgHareketSon = '';

function kgBaslat(){
  document.getElementById('kg-btn-alt').classList.remove('aktif');
  document.getElementById('kg-btn-ust').classList.remove('aktif');
  kgBolum = null;
  document.getElementById('secili-bolge-etiketi').innerText = 'Bölge Seçilmedi';
  document.getElementById('kg-giris').innerHTML = '<div class="muted">Bölge seçin</div>';
  document.getElementById('kg-malzeme').innerHTML = '';
  document.getElementById('kg-adres').innerHTML = '';
  document.getElementById('kg-rapor').innerHTML = '';
}

function kgBolgeSec(b){
  kgBolum = b;
  document.getElementById('kg-btn-alt').classList.toggle('aktif', b === 'alt');
  document.getElementById('kg-btn-ust').classList.toggle('aktif', b === 'ust');
  document.getElementById('secili-bolge-etiketi').innerText = 'Bölge: ' + (b === 'ust' ? 'E5 Üstü' : 'E5 Altı');
  kgHareketBas = '';
  kgHareketSon = '';
  kgMatQuery = '';
  kgAdrQuery = '';
  kgDinleyicileriKur();
}

function kgBolumLabel(b){ return b === 'ust' ? 'E5 Üstü' : 'E5 Altı'; }

function kgDinleyicileriKur(){
  detachListeners();
  kgMalzemeler = [];
    kgAdresler = [];
    kgKullanimlar = [];
    kgHareketler = [];

    const bolumAd = kgBolumLabel(kgBolum);
    const un1 = db.collection('malzemeler_' + kgBolum).onSnapshot(s => {
        kgMalzemeler = s.docs.map(d => ({ id: d.id, ...d.data() }));
        kgHesaplaVeCiz();
    });
  const un2 = db.collection('kullanim_' + kgBolum).onSnapshot(s => {
    kgKullanimlar = s.docs.map(d => ({ id: d.id, ...d.data() }));
    kgHesaplaVeCiz();
  });
  const un3 = db.collection('adresler_' + kgBolum).onSnapshot(s => {
    kgAdresler = s.docs.map(d => ({ id: d.id, ...d.data() }));
    kgRenderAdresler();
  });
  const un4 = db.collection('stok_hareketleri').where('bolum', '==', bolumAd).onSnapshot(s => {
    kgHareketler = s.docs.map(d => ({ id: d.id, ...d.data() }));
    kgRenderRapor();
  });
  window.aktifListeners.push(un1, un2, un3, un4);
  kgTabGoster('giris');
}

function kgTabGoster(tab){
  document.querySelectorAll('#kullanim-modulu .tab-btn').forEach(b => b.classList.toggle('aktif', b.dataset.kgtab === tab));
  ['giris', 'malzeme', 'adres', 'rapor'].forEach(t => document.getElementById('kg-' + t).classList.toggle('gizli', t !== tab));
  
  // Arama değişkenlerini sıfırla
  kgMatQuery = '';
  kgAdrQuery = '';
  // (Hareket filtresi zaten kgBolgeSec ile sıfırlanıyor, ama yine de ekleyelim)
  kgHareketBas = '';
  kgHareketSon = '';

  // İlgili sekmeyi render et (böylece input değerleri de boş gelir)
  if (tab === 'giris') kgRenderGiris();
  if (tab === 'malzeme') kgRenderMalzemeTablo();
  if (tab === 'adres') kgRenderAdresler();
  if (tab === 'rapor') kgRenderRapor();
}

function kgMalzemelerHesaplanmis(){
  return kgMalzemeler.map(m => {
    const kullanilan = kgKullanimlar.filter(u => trLower(u.malzeme) === trLower(m.ad)).reduce((s, u) => s + Number(u.miktar || 0), 0);
    const kalan = Number(m.baslangic || 0) - kullanilan;
    const durum = kalan <= 0 ? 'STOK YOK' : (kalan < Number(m.baslangic || 0) * 0.2 ? 'AZ STOK' : 'YETERLİ');
    return { ...m, kullanilan, kalan, durum };
  });
}

function kgHesaplaVeCiz(){ kgRenderGiris(); kgRenderMalzemeTablo(); }

function kgRenderGiris(){
  const sorted = kgKullanimlar.slice().sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
  let rows = sorted.map(u => `<tr>
    <td class="mono">${esc(u.tarih)} ${esc(u.saat)}</td>
    <td><span class="clickable-text" onclick="kgMalzemeGecmis('${esc(u.malzeme).replace(/'/g, "\\'")}')">${esc(u.malzeme)}</span></td>
    <td class="text-right">${u.miktar}</td>
    <td><span class="clickable-text" onclick="kgAdresGecmis('${esc(u.adres).replace(/'/g, "\\'")}')">${esc(u.adres)}</span></td>
    <td class="hide-mobile">${esc(u.aciklama || '')}</td>
    <td class="text-right"><button class="icon-btn" onclick="kgKullanimDuzenle('${u.id}')"><i class="fa-solid fa-pen"></i></button> <button class="icon-btn" onclick="kgKullanimSil('${u.id}')"><i class="fa-solid fa-xmark"></i></button></td>
  </tr>`).join('');
  if (!rows) rows = '<tr><td colspan="6" class="muted">Henüz kullanım kaydı yok.</td></tr>';
  document.getElementById('kg-giris').innerHTML = `
    <div class="card"><h3>Yeni Kullanım Kaydı (${kgBolumLabel(kgBolum)})</h3>
    <div class="grid3">
      <div><label class="f">Tarih</label><input id="kg-u-tarih" type="date" value="${isoBugun()}"></div>
      <div class="suggest-wrap"><label class="f">Malzeme *</label><input id="kg-u-malzeme" autocomplete="off" placeholder="Yazmaya başlayın..." oninput="kgMalzemeOneriGoster()" onfocus="kgMalzemeOneriGoster()"><div class="suggest-list" id="kg-u-malzeme-list"></div></div>
      <div><label class="f">Miktar *</label><input id="kg-u-miktar" type="number" min="1" step="1" placeholder="5"></div>
      <div class="suggest-wrap"><label class="f">Nereye Kullanıldı *</label><input id="kg-u-adres" autocomplete="off" placeholder="Yazmaya başlayın..." oninput="kgAdresOneriGoster()" onfocus="kgAdresOneriGoster()"><div class="suggest-list" id="kg-u-adres-list"></div></div>
      <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="kg-u-aciklama" placeholder="Açıklama"></div>
      <div><button class="btn btn-blue w-full" onclick="kgKullanimEkle()">+ Kaydet</button></div>
    </div></div>
    <div class="card" style="overflow:auto"><table><thead><tr><th>Tarih/Saat</th><th>Malzeme</th><th class="text-right">Miktar</th><th>Nereye</th><th class="hide-mobile">Açıklama</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function kgMalzemeOneriGoster(){
  const val = trLower(document.getElementById('kg-u-malzeme').value.trim());
  const all = kgMalzemeler.map(m => m.ad);
  const matches = val ? all.filter(a => trLower(a).indexOf(val) > -1) : all.slice(0, 6);
  renderSuggest(document.getElementById('kg-u-malzeme-list'), matches.slice(0, 8), v => {
    document.getElementById('kg-u-malzeme').value = v;
  }, document.getElementById('kg-u-malzeme'));
}

// ========== ADRES ÖNERİSİ (KULLANIM GİRİŞİ İÇİN BİRLEŞİK GÖRÜNÜM) ==========
function kgAdresOneriGoster() {
    const val = trLower(document.getElementById('kg-u-adres').value.trim());
    // Birleşik adres listesi oluştur
    const tumAdresler = kgAdresler.map(a => (a.mahalle || '') + ' ' + (a.adres || '')).filter(Boolean);
    const matches = val ? tumAdresler.filter(a => trLower(a).indexOf(val) > -1) : tumAdresler.slice(0, 8);
    renderSuggest(document.getElementById('kg-u-adres-list'), matches.slice(0, 8), v => {
        document.getElementById('kg-u-adres').value = v;
    }, document.getElementById('kg-u-adres'));
}

function kgAdresVarMi(tamAdres) {
    return kgAdresler.some(a => trLower((a.mahalle || '') + ' ' + (a.adres || '')) === trLower(tamAdres));
}

async function kgKullanimEkle(){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  const malzeme = document.getElementById('kg-u-malzeme').value.trim();
  const miktar = Number(document.getElementById('kg-u-miktar').value);
  const adres = document.getElementById('kg-u-adres').value.trim();
  const aciklama = document.getElementById('kg-u-aciklama').value.trim();
  const tarihIso = document.getElementById('kg-u-tarih').value || isoBugun();
  if (!malzeme || !miktar || !adres) return toast('Zorunlu alanları doldurun');
  if (!kgMalzemeler.some(m => trLower(m.ad) === trLower(malzeme)) || !kgAdresVarMi(adres)) return toast('Geçersiz malzeme/adres');
  const n = nowTarih();
  await db.collection('kullanim_' + kgBolum).add({
    tarih: isoToDisplay(tarihIso), tarihISO: tarihIso, saat: n.saat,
    malzeme, miktar, adres, aciklama, kullanici: kullaniciAdi()
  });
  await db.collection('stok_hareketleri').add({
    tarih: n.display, tarihISO: n.iso, saat: n.saat,
    bolum: kgBolumLabel(kgBolum), islem: 'KULLANIM', malzeme,
    miktarDegisim: -miktar, aciklama: 'Adres: ' + adres, kullanici: kullaniciAdi()
  });
  document.getElementById('kg-u-malzeme').value = '';
  document.getElementById('kg-u-miktar').value = '';
  document.getElementById('kg-u-adres').value = '';
  document.getElementById('kg-u-aciklama').value = '';
  toast('Kayıt eklendi');
}

function kgKullanimDuzenle(id){
  const u = kgKullanimlar.find(x => x.id === id);
  if (!u) return;
  openModal('Kullanım Düzenle', `
    <div class="grid3">
      <div><label class="f">Tarih</label><input id="duz-tarih" type="date" value="${u.tarihISO}"></div>
      <div class="suggest-wrap"><label class="f">Malzeme</label><input id="duz-malzeme" value="${esc(u.malzeme)}" oninput="kgDuzMalzemeOneri()" onfocus="kgDuzMalzemeOneri()"><div class="suggest-list" id="duz-malzeme-list"></div></div>
      <div><label class="f">Miktar</label><input id="duz-miktar" type="number" value="${u.miktar}"></div>
      <div class="suggest-wrap"><label class="f">Adres</label><input id="duz-adres" value="${esc(u.adres)}" oninput="kgDuzAdresOneri()" onfocus="kgDuzAdresOneri()"><div class="suggest-list" id="duz-adres-list"></div></div>
      <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="duz-aciklama" value="${esc(u.aciklama || '')}"></div>
      <div><button class="btn btn-blue w-full" onclick="kgKullanimGuncelle('${id}')">Güncelle</button></div>
    </div>
  `);
}

async function kgKullanimGuncelle(id) {
    if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
    const malzeme = document.getElementById('duz-malzeme').value.trim();
    const miktar = Number(document.getElementById('duz-miktar').value);
    const adres = document.getElementById('duz-adres').value.trim();
    const aciklama = document.getElementById('duz-aciklama').value.trim();
    const tarihIso = document.getElementById('duz-tarih').value;

    // Zorunlu alan kontrolü
    if (!malzeme || !miktar || !adres) return toast('Tüm zorunlu alanları doldurun.');

    // Malzeme ve adres geçerlilik kontrolü
    if (!kgMalzemeler.some(m => trLower(m.ad) === trLower(malzeme))) return toast('Geçersiz malzeme.');
    if (!kgAdresVarMi(adres)) return toast('Geçersiz adres.');

    await db.collection('kullanim_' + kgBolum).doc(id).update({
        malzeme, miktar, adres, aciklama,
        tarih: isoToDisplay(tarihIso), tarihISO: tarihIso
    });
    closeModal();
    toast('Güncellendi');
}

function kgDuzMalzemeOneri(){
  const val = trLower(document.getElementById('duz-malzeme').value.trim());
  const all = kgMalzemeler.map(m => m.ad);
  const matches = val ? all.filter(a => trLower(a).indexOf(val) > -1) : all.slice(0, 6);
  renderSuggest(document.getElementById('duz-malzeme-list'), matches.slice(0, 8), v => {
    document.getElementById('duz-malzeme').value = v;
  }, document.getElementById('duz-malzeme'));
}

function kgDuzAdresOneri(){
  const val = trLower(document.getElementById('duz-adres').value.trim());
  const all = kgAdresler.map(a => a.ad);
  const matches = val ? all.filter(a => trLower(a).indexOf(val) > -1) : all.slice(0, 6);
  renderSuggest(document.getElementById('duz-adres-list'), matches.slice(0, 8), v => {
    document.getElementById('duz-adres').value = v;
  }, document.getElementById('duz-adres'));
}

async function kgKullanimSil(id){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  const u = kgKullanimlar.find(x => x.id === id);
  if (!u) return;
  appConfirm('Kaydı silmek istediğinize emin misiniz?', async () => {
    await db.collection('kullanim_' + kgBolum).doc(id).delete();
    const n = nowTarih();
    await db.collection('stok_hareketleri').add({
      tarih: n.display, tarihISO: n.iso, saat: n.saat,
      bolum: kgBolumLabel(kgBolum), islem: 'KULLANIM SİLİNDİ', malzeme: u.malzeme,
      miktarDegisim: Number(u.miktar), aciklama: 'Stok geri eklendi', kullanici: kullaniciAdi()
    });
    toast('Silindi');
  });
}

function kgMalzemeGecmis(malzemeAdi){
  const kayitlar = kgKullanimlar.filter(k => trLower(k.malzeme) === trLower(malzemeAdi))
    .sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
  let rows = kayitlar.map(k => `<tr><td>${esc(k.tarih)} ${esc(k.saat)}</td><td>${esc(k.adres)}</td><td class="text-right">${k.miktar}</td><td>${esc(k.aciklama || '')}</td></tr>`).join('');
  openModal(`${esc(malzemeAdi)} Kullanım Geçmişi`, `<table><thead><tr><th>Tarih/Saat</th><th>Adres</th><th class="text-right">Miktar</th><th>Açıklama</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok</td></tr>'}</tbody></table>`);
}

function kgAdresGecmis(adres){
  const kayitlar = kgKullanimlar.filter(k => k.adres === adres)
    .sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
  let rows = kayitlar.map(k => `<tr><td>${esc(k.tarih)} ${esc(k.saat)}</td><td>${esc(k.malzeme)}</td><td class="text-right">${k.miktar}</td><td>${esc(k.aciklama || '')}</td></tr>`).join('');
  openModal(`${esc(adres)} Adres Kullanımı`, `<table><thead><tr><th>Tarih/Saat</th><th>Malzeme</th><th class="text-right">Miktar</th><th>Açıklama</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok</td></tr>'}</tbody></table>`);
}

// Malzeme sekmesi
function kgRenderMalzemeTablo(){
  if (document.getElementById('kg-mat-ara')) {
        document.getElementById('kg-mat-ara').value = '';
    }
  const q = trLower(kgMatQuery);
  const list = kgMalzemelerHesaplanmis().filter(m => !q || trLower(m.kod + ' ' + m.ad + ' ' + (m.aciklama || '')).indexOf(q) > -1);
  let rows = list.map(m => `<tr>
    <td class="mono clickable-text" onclick="kgMalzemeDetay('${m.id}')">${esc(m.kod || '(boş)')}</td>
    <td class="clickable-text" onclick="kgMalzemeGecmis('${esc(m.ad).replace(/'/g, "\\'")}')">${esc(m.ad)}</td>
    <td class="text-right">${m.baslangic}</td><td class="text-right">${m.kalan}</td><td>${durumBadge(m.durum)}</td>
    <td class="text-right"><button class="icon-btn" onclick="kgMalzemeDuzenle('${m.id}')"><i class="fa-solid fa-pen"></i></button> <button class="icon-btn" onclick="kgMalzemeSil('${m.id}','${esc(m.ad).replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash text-red-400"></i></button></td>
  </tr>`).join('');
  if (!rows) rows = '<tr><td colspan="6" class="muted">Sonuç yok.</td></tr>';
  document.getElementById('kg-malzeme').innerHTML = `
    <div class="card"><div class="flex justify-between items-center flex-wrap gap-2"><h3>Malzemeler (${kgMalzemeler.length})</h3><div class="flex gap-2"><button class="btn btn-gray" onclick="kgExcelYukleModal()"><i class="fa-solid fa-file-excel"></i> Excel Yükle</button><button class="btn btn-blue" onclick="kgMalzemeEkleModal()">+ Malzeme Ekle</button></div></div>
    <input id="kg-mat-ara" value="${esc(kgMatQuery)}" class="mt-3" placeholder="Ara..." oninput="kgMatQuery=this.value;kgRenderMalzemeTablo();"></div>
    <div class="card" style="overflow:auto"><table><thead><tr><th>Kod</th><th>Ad</th><th class="text-right">Başlangıç</th><th class="text-right">Kalan</th><th>Durum</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function kgMalzemeDetay(id){
  const m = kgMalzemeler.find(x => x.id === id);
  if (!m) return;
  openModal('Malzeme Detayı', `<div class="text-sm"><b>Kod:</b> ${esc(m.kod || '-')}<br><b>Ad:</b> ${esc(m.ad)}<br><b>Birim:</b> ${esc(m.birim || 'Adet')}<br><b>Açıklama:</b> ${esc(m.aciklama || '-')}<br><b>Başlangıç Stok:</b> ${m.baslangic}</div><div class="mt-4"><button class="btn btn-blue" onclick="closeModal();kgMalzemeDuzenle('${id}')">Düzenle</button></div>`);
}

function kgMalzemeEkleModal(){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  openModal('Malzeme Ekle', `<div class="grid3">
    <div><label class="f">Kod</label><input id="km-kod"></div>
    <div><label class="f">Ad *</label><input id="km-ad"></div>
    <div><label class="f">Birim</label><input id="km-birim" value="Adet"></div>
    <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="km-aciklama"></div>
    <div><label class="f">Başlangıç Stok *</label><input id="km-bas" type="number" min="0" step="1"></div>
    <div><button class="btn btn-blue w-full mt-4" onclick="kgMalzemeKaydet()">Kaydet</button></div>
  </div>`);
}

async function kgMalzemeKaydet(){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  const ad = document.getElementById('km-ad').value.trim();
  const bas = Number(document.getElementById('km-bas').value);
  if (!ad || isNaN(bas)) return toast('Ad ve başlangıç stok gerekli');
  if (kgMalzemeler.some(m => trLower(m.ad) === trLower(ad))) return toast('Bu malzeme zaten var');
  await db.collection('malzemeler_' + kgBolum).add({
    kod: document.getElementById('km-kod').value.trim(), ad,
    aciklama: document.getElementById('km-aciklama').value.trim(),
    birim: document.getElementById('km-birim').value.trim(),
    baslangic: bas
  });
  const n = nowTarih();
  await db.collection('stok_hareketleri').add({
    tarih: n.display, tarihISO: n.iso, saat: n.saat,
    bolum: kgBolumLabel(kgBolum), islem: 'YENİ MALZEME', malzeme: ad,
    miktarDegisim: bas, aciklama: 'Başlangıç stok: ' + bas, kullanici: kullaniciAdi()
  });
  closeModal(); toast('Malzeme eklendi');
}

function kgMalzemeDuzenle(id){
  const m = kgMalzemeler.find(x => x.id === id);
  if (!m) return;
  openModal('Malzeme Düzenle', `<div class="grid3">
    <div><label class="f">Kod</label><input id="em-kod" value="${esc(m.kod || '')}"></div>
    <div><label class="f">Ad *</label><input id="em-ad" value="${esc(m.ad)}"></div>
    <div><label class="f">Birim</label><input id="em-birim" value="${esc(m.birim || '')}"></div>
    <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="em-aciklama" value="${esc(m.aciklama || '')}"></div>
    <div><label class="f">Başlangıç Stok *</label><input id="em-bas" type="number" value="${m.baslangic}"></div>
    <div><button class="btn btn-blue w-full mt-4" onclick="kgMalzemeGuncelle('${id}')">Güncelle</button></div>
  </div>`);
}

async function kgMalzemeGuncelle(id){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  const m = kgMalzemeler.find(x => x.id === id);
  const eskiBas = m ? Number(m.baslangic || 0) : 0;
  const ad = document.getElementById('em-ad').value.trim();
  const bas = Number(document.getElementById('em-bas').value);
  if (!ad) return toast('Ad boş olamaz');
  await db.collection('malzemeler_' + kgBolum).doc(id).set({
    kod: document.getElementById('em-kod').value.trim(), ad,
    aciklama: document.getElementById('em-aciklama').value.trim(),
    birim: document.getElementById('em-birim').value.trim(), baslangic: bas
  }, { merge: true });
  if (eskiBas !== bas) {
    const n = nowTarih();
    await db.collection('stok_hareketleri').add({
      tarih: n.display, tarihISO: n.iso, saat: n.saat,
      bolum: kgBolumLabel(kgBolum), islem: 'STOK GÜNCELLE', malzeme: ad,
      miktarDegisim: bas - eskiBas, aciklama: 'Stok: ' + eskiBas + ' → ' + bas, kullanici: kullaniciAdi()
    });
  }
  closeModal(); toast('Güncellendi');
}

function kgMalzemeSil(id, ad){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  const kullanimSayisi = kgKullanimlar.filter(u => trLower(u.malzeme) === trLower(ad)).length;
  let msg = '"' + ad + '" malzemesini silmek istediğinize emin misiniz?';
  if (kullanimSayisi > 0) msg += '<br>Bu malzemeye ait ' + kullanimSayisi + ' kullanım kaydı da silinecek!';
  appConfirm(msg, async () => {
    const batch = db.batch();
    kgKullanimlar.filter(u => trLower(u.malzeme) === trLower(ad)).forEach(u => batch.delete(db.collection('kullanim_' + kgBolum).doc(u.id)));
    batch.delete(db.collection('malzemeler_' + kgBolum).doc(id));
    await batch.commit();
    toast('Malzeme silindi');
  });
}

function kgExcelYukleModal(){
  openModal('Excel\'den Toplu Malzeme Yükle', `<p class="text-xs text-gray-400 mb-2">Sütunlar: Kod, Ad, Birim, Açıklama, Başlangıç (başlık satırı olmalı)</p><input type="file" id="km-excel" accept=".xlsx,.xls"><button class="btn btn-blue w-full mt-3" onclick="kgExcelYukle()">Yükle</button>`);
}

function kgExcelYukle(){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  const f = document.getElementById('km-excel').files[0];
  if (!f) return toast('Dosya seçin');
  const reader = new FileReader();
  reader.onload = async (e) => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    if (!json.length) return toast('Veri yok');
    const mevcut = kgMalzemeler.map(m => trLower(m.ad));
    const batch = db.batch(); let eklenen = 0;
    json.forEach(row => {
      const ad = String(row.Ad || row.ad || '').trim();
      if (!ad || mevcut.indexOf(trLower(ad)) > -1) return;
      batch.set(db.collection('malzemeler_' + kgBolum).doc(), {
        ad, kod: String(row.Kod || row.kod || ''),
        birim: String(row.Birim || row.birim || 'Adet'),
        aciklama: String(row.Aciklama || row.aciklama || ''),
        baslangic: Number(row.Baslangic || row.baslangic || 0)
      });
      mevcut.push(trLower(ad)); eklenen++;
    });
    if (eklenen === 0) return toast('Eklenecek yeni malzeme yok');
    await batch.commit();
    closeModal(); toast(eklenen + ' malzeme eklendi');
  };
  reader.readAsArrayBuffer(f);
}

// ========== ADRES LİSTESİ (MAHALLE GRUPLU) ==========
function kgRenderAdresler() {
    // Arama kutusunu sıfırla (güvenlik için)
    if (document.getElementById('kg-adr-ara')) {
        document.getElementById('kg-adr-ara').value = '';
    }
    // Eğer kgBolum seçili değilse hiç render etme
    if (!kgBolum) {
        document.getElementById('kg-adres').innerHTML = '<div class="muted">Lütfen önce bir bölge seçin.</div>';
        return;
    }

    // kgAdresler boş veya tanımsız ise mesaj göster
    if (!kgAdresler || kgAdresler.length === 0) {
        document.getElementById('kg-adres').innerHTML = `
            <div class="card"><div class="flex justify-between items-center"><h3>Adresler (0)</h3><div class="flex gap-2"><button class="btn btn-gray" onclick="kgAdresExcelYukleModal()"><i class="fa-solid fa-file-excel"></i> Excel Yükle</button><button class="btn btn-blue" onclick="kgAdresEkleModal()">+ Adres Ekle</button></div></div></div>
            <div class="muted">Henüz adres yok.</div>
        `;
        return;
    }

    const q = trLower(kgAdrQuery);
    const filtrelenmis = kgAdresler.filter(a => {
        if (!q) return true;
        const tamAdres = (a.mahalle || '') + ' ' + (a.adres || '');
        return trLower(tamAdres).indexOf(q) > -1;
    }).sort((a, b) => {
        if (a.mahalle !== b.mahalle) return a.mahalle.localeCompare(b.mahalle, 'tr');
        return a.adres.localeCompare(b.adres, 'tr');
    });

    // Mahalle grupları
    const gruplar = {};
    filtrelenmis.forEach(a => {
        const m = a.mahalle || 'Diğer';
        if (!gruplar[m]) gruplar[m] = [];
        gruplar[m].push(a);
    });

    let html = '';
    for (const [mahalle, adresler] of Object.entries(gruplar)) {
        html += `<div class="card mb-2"><h3 class="text-sm text-teal-300">${esc(mahalle)} (${adresler.length})</h3>
        <table><thead><tr><th>Adres Detayı</th><th>Onay</th><th></th></tr></thead><tbody>`;
        adresler.forEach(a => {
            html += `<tr>
                <td><span class="clickable-text" onclick="kgAdresGecmis('${esc((a.mahalle + ' ' + a.adres).replace(/'/g, "\\'"))}')">${esc(a.adres)}</span></td>
                <td>${a.onay === true ? '<span class="text-green-400">Onaylı</span>' : a.onay === false ? '<span class="text-red-400">Reddedildi</span>' : '<span class="text-gray-500">Beklemede</span>'}</td>
                <td class="text-right">
                    <button class="icon-btn" onclick="kgAdresDuzenle('${a.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn" onclick="kgAdresSil('${a.id}')"><i class="fa-solid fa-trash text-red-400"></i></button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    if (!html) html = '<div class="muted">Aramanızla eşleşen adres yok.</div>';

    document.getElementById('kg-adres').innerHTML = `
        <div class="card"><div class="flex justify-between items-center"><h3>Adresler (${kgAdresler.length})</h3><div class="flex gap-2"><button class="btn btn-gray" onclick="kgAdresExcelYukleModal()"><i class="fa-solid fa-file-excel"></i> Excel Yükle</button><button class="btn btn-blue" onclick="kgAdresEkleModal()">+ Adres Ekle</button></div></div>
        <input id="kg-adr-ara" value="${esc(kgAdrQuery)}" class="mt-3" placeholder="Mahalle veya adres ara..." oninput="kgAdrQuery=this.value;kgRenderAdresler();"></div>
        ${html}
    `;
}

// ========== ADRES EKLEME ==========
function kgAdresEkleModal() {
    openModal('Adres Ekle', `
        <div class="grid3">
            <div><label class="f">Mahalle *</label><input id="ka-mahalle" placeholder="Mahalle adı"></div>
            <div><label class="f">Adres Detayı *</label><input id="ka-adres" placeholder="Sokak, cadde, no..."></div>
        </div>
        <button class="btn btn-blue w-full mt-3" onclick="kgAdresKaydet()">Kaydet</button>
    `);
}

async function kgAdresKaydet() {
    if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
    const mahalle = document.getElementById('ka-mahalle').value.trim();
    const adresDetay = document.getElementById('ka-adres').value.trim();
    if (!mahalle || !adresDetay) return toast('Mahalle ve adres detayı zorunludur.');

    // Aynı mahalle+adres kombinasyonu var mı?
    const mevcut = kgAdresler.some(a => trLower(a.mahalle) === trLower(mahalle) && trLower(a.adres) === trLower(adresDetay));
    if (mevcut) return toast('Bu adres zaten kayıtlı.');

    await db.collection('adresler_' + kgBolum).add({
        mahalle: mahalle,
        adres: adresDetay,
        onay: null
    });
    closeModal();
    toast('Adres eklendi');
}

// ========== ADRES DÜZENLEME ==========
function kgAdresDuzenle(id) {
    const a = kgAdresler.find(x => x.id === id);
    if (!a) return;
    openModal('Adres Düzenle', `
        <div class="grid3">
            <div><label class="f">Mahalle</label><input id="ea-mahalle" value="${esc(a.mahalle || '')}"></div>
            <div><label class="f">Adres Detayı</label><input id="ea-adres" value="${esc(a.adres || '')}"></div>
        </div>
        <label class="f mt-3">Onay Durumu</label>
        <div class="flex gap-2 mb-3" id="ea-onay-btns">
            <button type="button" class="btn ${a.onay === true ? 'btn-green' : 'btn-gray'}" onclick="kgAdresOnaySec(true)"><i class="fa-solid fa-check"></i> Onayla</button>
            <button type="button" class="btn ${a.onay === false ? 'btn-red' : 'btn-gray'}" onclick="kgAdresOnaySec(false)"><i class="fa-solid fa-xmark"></i> Reddet</button>
            <button type="button" class="btn btn-gray" onclick="kgAdresOnaySec(null)">Temizle</button>
        </div>
        <input type="hidden" id="ea-onay" value="${a.onay === true ? 'true' : a.onay === false ? 'false' : 'null'}">
        <button class="btn btn-blue w-full" onclick="kgAdresGuncelle('${id}')">Güncelle</button>
    `);
}

async function kgAdresGuncelle(id) {
    if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
    const mahalle = document.getElementById('ea-mahalle').value.trim();
    const adresDetay = document.getElementById('ea-adres').value.trim();
    if (!mahalle || !adresDetay) return toast('Mahalle ve adres detayı boş olamaz.');
    const onayVal = document.getElementById('ea-onay').value;
    const onay = onayVal === 'true' ? true : onayVal === 'false' ? false : null;
    await db.collection('adresler_' + kgBolum).doc(id).update({ mahalle, adres: adresDetay, onay });
    closeModal();
    toast('Güncellendi');
}

function kgAdresSil(id){
  if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
  appConfirm('Bu adresi silmek istediğinize emin misiniz?', async () => {
    await db.collection('adresler_' + kgBolum).doc(id).delete();
    toast('Adres silindi');
  });
}

function kgAdresExcelYukleModal(){
  openModal('Excel\'den Toplu Adres Yükle', `<p class="text-xs text-gray-400 mb-2">Sadece "Adres" sütunu olmalı.</p><input type="file" id="ka-excel" accept=".xlsx,.xls"><button class="btn btn-blue w-full mt-3" onclick="kgAdresExcelYukle()">Yükle</button>`);
}

// ========== EXCEL YÜKLEME (İKİ SÜTUN) ==========
function kgAdresExcelYukleModal() {
    openModal('Excel\'den Toplu Adres Yükle', `
        <p class="text-xs text-gray-400 mb-2">Sütunlar: <b>Mahalle</b>, <b>Adres Detayı</b> (başlık olmalı)</p>
        <input type="file" id="ka-excel" accept=".xlsx,.xls">
        <button class="btn btn-blue w-full mt-3" onclick="kgAdresExcelYukle()">Yükle</button>
    `);
}

async function kgAdresExcelYukle() {
    if (!kgBolum) { toast('Lütfen önce bir bölge seçin.'); return; }
    const f = document.getElementById('ka-excel').files[0];
    if (!f) return toast('Dosya seçin');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!json.length) return toast('Veri yok');
        const batch = db.batch();
        let eklenen = 0;
        const mevcutSet = new Set(kgAdresler.map(a => trLower(a.mahalle + '|||' + a.adres)));
        json.forEach(row => {
            const mahalle = String(row.Mahalle || row.mahalle || '').trim();
            const adresDetay = String(row['Adres Detayı'] || row['Adres'] || row.adres || '').trim();
            if (!mahalle || !adresDetay) return;
            const key = trLower(mahalle + '|||' + adresDetay);
            if (mevcutSet.has(key)) return;
            batch.set(db.collection('adresler_' + kgBolum).doc(), { mahalle, adres: adresDetay, onay: null });
            mevcutSet.add(key);
            eklenen++;
        });
        if (eklenen === 0) return toast('Yeni adres bulunamadı');
        await batch.commit();
        closeModal();
        toast(eklenen + ' adres eklendi');
    };
    reader.readAsArrayBuffer(f);
}

// Rapor sekmesi
function kgRenderRapor(){
  const hesap = kgMalzemelerHesaplanmis();
  const stokYok = hesap.filter(m => m.durum === 'STOK YOK').length;
  const azStok = hesap.filter(m => m.durum === 'AZ STOK').length;
  const bolumAd = kgBolumLabel(kgBolum);
  let filtreli = kgHareketler.slice();
  if (kgHareketBas) filtreli = filtreli.filter(h => h.tarihISO >= kgHareketBas);
  if (kgHareketSon) filtreli = filtreli.filter(h => h.tarihISO <= kgHareketSon);
  filtreli.sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
  let rows = filtreli.map(h => `<tr><td>${esc(h.tarih)} ${esc(h.saat)}</td><td>${esc(h.islem)}</td><td>${esc(h.malzeme)}</td><td class="text-right">${h.miktarDegisim > 0 ? '+' : ''}${h.miktarDegisim}</td><td>${esc(h.aciklama || '')}</td><td class="hide-mobile">${esc(h.kullanici || '')}</td></tr>`).join('');
  if (!rows) rows = '<tr><td colspan="6" class="muted">Hareket yok.</td></tr>';
  document.getElementById('kg-rapor').innerHTML = `
    <div class="card"><h3>Özet - ${bolumAd}</h3><div class="dash-grid">
      <div class="dash-card"><div class="num text-blue-400">${hesap.length}</div><div class="lbl">Malzeme</div></div>
      <div class="dash-card"><div class="num text-green-400">${kgKullanimlar.length}</div><div class="lbl">Kullanım</div></div>
      <div class="dash-card"><div class="num text-red-400">${stokYok}</div><div class="lbl">Stok Yok</div></div>
      <div class="dash-card"><div class="num text-yellow-400">${azStok}</div><div class="lbl">Az Stok</div></div>
    </div></div>
    <div class="card"><div class="flex justify-between flex-wrap gap-2 items-center">
      <div class="flex gap-2 items-center flex-wrap">
        <input type="date" id="kg-r-bas" value="${kgHareketBas}" style="width:140px" onchange="kgHareketBas=this.value;kgRenderRapor();">
        <span class="text-xs">—</span>
        <input type="date" id="kg-r-son" value="${kgHareketSon}" style="width:140px" onchange="kgHareketSon=this.value;kgRenderRapor();">
        <button class="btn btn-gray" onclick="kgHareketBas='';kgHareketSon='';kgRenderRapor();">Tümü</button>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-red" onclick="kgPdfDisaAktar()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
        <button class="btn btn-green" onclick="kgExcelDisaAktar()"><i class="fa-solid fa-file-excel"></i> Excel</button>
      </div>
    </div></div>
    <div class="card" style="overflow:auto"><table><thead><tr><th>Tarih/Saat</th><th>İşlem</th><th>Malzeme</th><th class="text-right">Değişim</th><th>Açıklama</th><th class="hide-mobile">Kullanıcı</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function kgFiltreliHareketler(){
  let f = kgHareketler.slice();
  if (kgHareketBas) f = f.filter(h => h.tarihISO >= kgHareketBas);
  if (kgHareketSon) f = f.filter(h => h.tarihISO <= kgHareketSon);
  return f.sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
}

function kgPdfDisaAktar(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(kgBolumLabel(kgBolum) + ' - Stok Hareketleri', 14, 15);
  const list = kgFiltreliHareketler();
  doc.autoTable({
    startY: 20,
    head: [['Tarih', 'Saat', 'Islem', 'Malzeme', 'Degisim', 'Acıklama']],
    body: list.map(h => [h.tarih, h.saat, h.islem, h.malzeme, h.miktarDegisim, h.aciklama || ''])
  });
  doc.save('stok_hareketleri_' + kgBolum + '.pdf');
}

function kgExcelDisaAktar(){
  const list = kgFiltreliHareketler();
  const rows = [['Tarih', 'Saat', 'İşlem', 'Malzeme', 'Değişim', 'Açıklama', 'Kullanıcı']]
    .concat(list.map(h => [h.tarih, h.saat, h.islem, h.malzeme, h.miktarDegisim, h.aciklama || '', h.kullanici || '']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Hareketler');
  XLSX.writeFile(wb, 'stok_hareketleri_' + kgBolum + '.xlsx');
}
