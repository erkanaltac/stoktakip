// depo.js – Depo Modülü
let depoMalzemeler = [], depoKayitlar = [], depoAdreslerAlt = [], depoAdreslerUst = [], depoHareketler = [], depoHareketBas = '', depoHareketSon = '';
var depoMatQuery = '';

function depoBaslat() {
    document.getElementById('depo-cikis').innerHTML = '<div class="muted">Yükleniyor...</div>';
    depoMatQuery = '';
    const un1 = kol('depo_malzemeler').onSnapshot(s => {
        depoMalzemeler = s.docs.map(d => ({ id: d.id, ...d.data() }));
        depoVeriGuncellendi();
    });
    const un2 = kol('depo_kayitlari').onSnapshot(s => {
        depoKayitlar = s.docs.map(d => ({ id: d.id, ...d.data() }));
        depoVeriGuncellendi();
    });
    // DÜZELTME: eskiden her onSnapshot tetiklendiğinde diziye "concat" ile ekleniyordu;
    // bu yüzden silinen adresler öneri listesinden asla çıkmıyor, listeler büyüdükçe
    // büyüyordu. Artık her bölüm kendi ayrı dizisinde tutulup her seferinde YENİDEN kuruluyor.
    const un3 = kol('adresler_alt').onSnapshot(s => {
        depoAdreslerAlt = s.docs.map(d => (d.data().mahalle || '') + ' ' + (d.data().adres || ''));
    });
    const un4 = kol('adresler_ust').onSnapshot(s => {
        depoAdreslerUst = s.docs.map(d => (d.data().mahalle || '') + ' ' + (d.data().adres || ''));
    });
    const un5 = kol('stok_hareketleri').where('bolum', '==', 'Depo').onSnapshot(s => {
        depoHareketler = s.docs.map(d => ({ id: d.id, ...d.data() }));
        depoRenderRapor();
    });
    window.aktifListeners.push(un1, un2, un3, un4, un5);
    depoHareketBas = '';
    depoHareketSon = '';
    depoTabGoster('cikis');
}

function depoAdresListesi() {
    return uniq(depoAdreslerAlt.concat(depoAdreslerUst));
}

function depoTabGoster(tab) {
    document.querySelectorAll('#depo-modulu .tab-btn').forEach(b =>
        b.classList.toggle('aktif', b.dataset.depotab === tab)
    );
    ['cikis', 'malzemeler', 'rapor'].forEach(t =>
        document.getElementById('depo-' + t).classList.toggle('gizli', t !== tab)
    );
    depoMatQuery = '';
    clearSearchInputs();

    if (tab === 'cikis') { depoRenderCikisIskelet(); depoRenderCikisForm(); depoRenderCikisTablo(); }
    if (tab === 'malzemeler') { depoRenderMalzemelerIskelet(); depoRenderMalzemelerUst(); depoRenderMalzemelerTablo(); }
    if (tab === 'rapor') depoRenderRapor();
}

function depoHesaplanmis() {
    return depoMalzemeler.map(m => {
        const kullanilan = depoKayitlar
            .filter(k => trLower(k.malzeme) === trLower(m.ad))
            .reduce((s, k) => s + Number(k.miktar || 0), 0);
        const kalan = Number(m.baslangic || 0) - kullanilan;
        const durum = kalan <= 0 ? 'STOK YOK' : (kalan < Number(m.baslangic || 0) * 0.2 ? 'AZ STOK' : 'YETERLİ');
        return { ...m, kullanilan, kalan, durum };
    });
}

// Firestore güncellemesi geldiğinde SADECE tabloları tazele; formlara dokunma.
function depoVeriGuncellendi(){
  depoRenderCikisTablo();
  depoRenderMalzemelerTablo();
}

// ===================== DEPO ÇIKIŞI (form + tablo ayrı) =====================

function depoRenderCikisIskelet(){
  document.getElementById('depo-cikis').innerHTML = `<div id="depo-cikis-form"></div><div id="depo-cikis-tablo"></div>`;
}

function depoRenderCikisForm(){
  const el = document.getElementById('depo-cikis-form');
  if (!el) return;
  el.innerHTML = `
    <div class="card"><h3>Depo Çıkışı</h3>
    <div class="grid3">
      <div class="suggest-wrap"><label class="f">Adres *</label><input id="depo-adres" autocomplete="off" oninput="depoAdresOneriGoster()" onfocus="depoAdresOneriGoster()"><div class="suggest-list" id="depo-adres-list"></div></div>
      <div class="suggest-wrap"><label class="f">Malzeme *</label><input id="depo-malzeme" autocomplete="off" oninput="depoMalzemeOneriGoster()" onfocus="depoMalzemeOneriGoster()"><div class="suggest-list" id="depo-malzeme-list"></div></div>
      <div><label class="f">Miktar *</label><input id="depo-miktar" type="number" min="1" step="1"></div>
      <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="depo-aciklama"></div>
      <div><button class="btn btn-blue w-full" id="depo-btn" onclick="depoCikisEkle()">Depodan Düş</button></div>
    </div></div>
  `;
}

function depoRenderCikisTablo(){
  const el = document.getElementById('depo-cikis-tablo');
  if (!el) return;
  const sorted = depoKayitlar.slice().sort((a,b)=>trKarsilastir(b.tarihISO+b.saat, a.tarihISO+a.saat));
  var rows = sorted.map(k=>`<tr>
    <td class="mono">${esc(k.tarih)} ${esc(k.saat)}</td>
    <td>${esc(k.malzeme)}</td>
    <td class="text-right">${k.miktar}</td>
    <td><span class="clickable-text" onclick="depoAdresGecmis('${esc(k.adres).replace(/'/g,"\\'")}')">${esc(k.adres)}</span></td>
    <td class="hide-mobile">${esc(k.aciklama||'')}</td>
    <td class="text-right"><button class="icon-btn" onclick="depoKayitSil('${k.id}')"><i class="fa-solid fa-xmark"></i></button></td>
  </tr>`).join('');
  if(!rows) rows='<tr><td colspan="6" class="muted">Henüz depo çıkışı yok.</td></tr>';
  el.innerHTML = `<div class="card" style="overflow:auto"><table><thead><tr><th>Tarih/Saat</th><th>Malzeme</th><th class="text-right">Miktar</th><th>Adres</th><th class="hide-mobile">Açıklama</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function depoAdresOneriGoster() {
    const val = trLower(document.getElementById('depo-adres').value.trim());
    const tumu = depoAdresListesi();
    const m = val ? tumu.filter(a => trLower(a).indexOf(val) > -1) : tumu.slice(0, 8);
    renderSuggest(document.getElementById('depo-adres-list'), m.slice(0, 8), v => {
        document.getElementById('depo-adres').value = v;
    }, document.getElementById('depo-adres'));
}

function depoMalzemeOneriGoster() {
    const val = trLower(document.getElementById('depo-malzeme').value.trim());
    const all = depoMalzemeler.map(m => m.ad);
    const m = val ? all.filter(a => trLower(a).indexOf(val) > -1) : all.slice(0, 8);
    renderSuggest(document.getElementById('depo-malzeme-list'), m.slice(0, 8), v => {
        document.getElementById('depo-malzeme').value = v;
    }, document.getElementById('depo-malzeme'));
}

async function depoCikisEkle(){
  const adres = formatText(document.getElementById('depo-adres').value);
  const malzeme = formatText(document.getElementById('depo-malzeme').value);
  const miktar = Number(document.getElementById('depo-miktar').value);
  const aciklama = formatText(document.getElementById('depo-aciklama').value);
  if(!adres||!malzeme||!miktar) return toast('Zorunlu alanları doldurun');
  if(!depoMalzemeler.some(m=>trLower(m.ad)===trLower(malzeme))) return toast('Geçersiz malzeme');
  const n=nowTarih();
  await kol('depo_kayitlari').add({ tarih:n.display, tarihISO:n.iso, saat:n.saat, malzeme, miktar, adres, aciklama, kullanici:kullaniciAdi() });
  await kol('stok_hareketleri').add({ tarih:n.display, tarihISO:n.iso, saat:n.saat, bolum:'Depo', islem:'DEPO ÇIKIŞI', malzeme, miktarDegisim:-miktar, aciklama:'Adres: '+adres, kullanici:kullaniciAdi() });
  document.getElementById('depo-malzeme').value=''; document.getElementById('depo-miktar').value=''; document.getElementById('depo-adres').value=''; document.getElementById('depo-aciklama').value='';
  toast('Depodan düşüldü');
}

function depoKayitSil(id) {
    const k = depoKayitlar.find(x => x.id === id);
    if (!k) return;
    appConfirm('Bu kaydı silmek istediğinizden emin misiniz? Miktar depo stoğuna geri eklenecek.', async () => {
        await kol('depo_kayitlari').doc(id).delete();
        const n = nowTarih();
        await kol('stok_hareketleri').add({
            tarih: n.display, tarihISO: n.iso, saat: n.saat,
            bolum: 'Depo', islem: 'DEPO İADE', malzeme: k.malzeme,
            miktarDegisim: Number(k.miktar), aciklama: 'Stok geri eklendi', kullanici: kullaniciAdi()
        });
        toast('Silindi');
    });
}

function depoAdresGecmis(adres) {
    const kayitlar = depoKayitlar
        .filter(k => k.adres === adres)
        .sort((a, b) => trKarsilastir(b.tarihISO + b.saat, a.tarihISO + a.saat));
    let rows = kayitlar.map(k => `<tr><td>${esc(k.tarih)} ${esc(k.saat)}</td><td>${esc(k.malzeme)}</td><td class="text-right">${k.miktar}</td><td>${esc(k.aciklama || '')}</td></tr>`).join('');
    openModal(`Depo - ${esc(adres)}`, `<table><thead><tr><th>Tarih/Saat</th><th>Malzeme</th><th class="text-right">Miktar</th><th>Açıklama</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok</td></tr>'}</tbody></table>`);
}

function depoMalzemeGecmis(malzemeAdi) {
    const kayitlar = depoKayitlar
        .filter(k => trLower(k.malzeme) === trLower(malzemeAdi))
        .sort((a, b) => trKarsilastir(b.tarihISO + b.saat, a.tarihISO + a.saat));
    let rows = kayitlar.map(k => `<tr><td>${esc(k.tarih)} ${esc(k.saat)}</td><td>${esc(k.adres)}</td><td class="text-right">${k.miktar}</td><td>${esc(k.aciklama || '')}</td></tr>`).join('');
    openModal(`Depo - ${esc(malzemeAdi)}`, `<table><thead><tr><th>Tarih/Saat</th><th>Adres</th><th class="text-right">Miktar</th><th>Açıklama</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok</td></tr>'}</tbody></table>`);
}

// ===================== DEPO MALZEMELERİ (üst kısım + tablo ayrı, artık ARAMA KUTULU) =====================

function depoRenderMalzemelerIskelet(){
  document.getElementById('depo-malzemeler').innerHTML = `<div id="depo-malzemeler-ust"></div><div id="depo-malzemeler-tablo"></div>`;
}

function depoRenderMalzemelerUst(){
  const el = document.getElementById('depo-malzemeler-ust');
  if (!el) return;
  el.innerHTML = `
    <div class="card"><div class="flex justify-between items-center"><h3>Depo Malzemeleri</h3><div class="flex gap-2"><button class="btn btn-gray" onclick="depoExcelYukleModal()"><i class="fa-solid fa-file-excel"></i> Excel Yükle</button><button class="btn btn-blue" onclick="depoMalzemeEkleModal()">+ Malzeme Ekle</button></div></div>
    <input id="depo-mat-ara" value="${esc(depoMatQuery)}" class="mt-3" placeholder="Kelime ile ara (kod, ad, açıklama)..." oninput="depoMatQuery=this.value;depoRenderMalzemelerTablo();"></div>
  `;
}

function depoRenderMalzemelerTablo() {
    const el = document.getElementById('depo-malzemeler-tablo');
    if (!el) return;
    const q = trLower(depoMatQuery);
    const list = depoHesaplanmis().filter(m => !q || trLower((m.kod||'') + ' ' + (m.ad||'') + ' ' + (m.aciklama || '')).indexOf(q) > -1);
    let rows = list.map(m => `<tr>
        <td class="mono">${esc(m.kod || '')}</td>
        <td class="clickable-text" onclick="depoMalzemeGecmis('${esc(m.ad).replace(/'/g, "\\'")}')">${esc(m.ad)}</td>
        <td class="text-right">${m.baslangic}</td><td class="text-right">${m.kalan}</td><td>${durumBadge(m.durum)}</td>
        <td class="text-right"><button class="icon-btn" onclick="depoMalzemeDuzenle('${m.id}')"><i class="fa-solid fa-pen"></i></button> <button class="icon-btn" onclick="depoMalzemeSil('${m.id}','${esc(m.ad).replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash text-red-400"></i></button></td>
    </tr>`).join('');
    if (!rows) rows = '<tr><td colspan="6" class="muted">Sonuç yok.</td></tr>';
    el.innerHTML = `
        <div class="card"><h3 class="mb-1">Depo Malzemeleri (${list.length}/${depoMalzemeler.length})</h3></div>
        <div class="card" style="overflow:auto"><table><thead><tr><th>Kod</th><th>Ad</th><th class="text-right">Başlangıç</th><th class="text-right">Kalan</th><th>Durum</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    `;
}

function depoMalzemeEkleModal() {
    openModal('Depo Malzemesi Ekle', `<div class="grid3">
        <div><label class="f">Kod</label><input id="dm-kod"></div>
        <div><label class="f">Ad *</label><input id="dm-ad"></div>
        <div><label class="f">Birim</label><input id="dm-birim" value="Adet"></div>
        <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="dm-aciklama"></div>
        <div><label class="f">Başlangıç Stok *</label><input id="dm-bas" type="number" min="0" step="1"></div>
        <div><button class="btn btn-blue w-full mt-4" onclick="depoMalzemeKaydet()">Kaydet</button></div>
    </div>`);
}

async function depoMalzemeKaydet() {
    const ad = formatText(document.getElementById('dm-ad').value);
    const bas = Number(document.getElementById('dm-bas').value);
    if (!ad || isNaN(bas)) return toast('Ad ve başlangıç stok gerekli');
    if (depoMalzemeler.some(m => trLower(m.ad) === trLower(ad))) return toast('Bu malzeme zaten var');
    await kol('depo_malzemeler').add({
        kod: document.getElementById('dm-kod').value.trim(),
        ad: ad,
        aciklama: formatText(document.getElementById('dm-aciklama').value),
        birim: document.getElementById('dm-birim').value.trim(),
        baslangic: bas
    });
    const n = nowTarih();
    await kol('stok_hareketleri').add({
        tarih: n.display, tarihISO: n.iso, saat: n.saat,
        bolum: 'Depo', islem: 'YENİ MALZEME', malzeme: ad,
        miktarDegisim: bas, aciklama: 'Başlangıç stok: ' + bas, kullanici: kullaniciAdi()
    });
    closeModal();
    toast('Depo malzemesi eklendi');
}

function depoMalzemeDuzenle(id) {
    const m = depoMalzemeler.find(x => x.id === id);
    if (!m) return;
    openModal('Depo Malzemesi Düzenle', `<div class="grid3">
        <div><label class="f">Kod</label><input id="edm-kod" value="${esc(m.kod || '')}"></div>
        <div><label class="f">Ad *</label><input id="edm-ad" value="${esc(m.ad)}"></div>
        <div><label class="f">Birim</label><input id="edm-birim" value="${esc(m.birim || '')}"></div>
        <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="edm-aciklama" value="${esc(m.aciklama || '')}"></div>
        <div><label class="f">Başlangıç Stok *</label><input id="edm-bas" type="number" value="${m.baslangic}"></div>
        <div><button class="btn btn-blue w-full mt-4" onclick="depoMalzemeGuncelle('${id}')">Güncelle</button></div>
    </div>`);
}

async function depoMalzemeGuncelle(id) {
    const m = depoMalzemeler.find(x => x.id === id);
    const eskiBas = m ? Number(m.baslangic || 0) : 0;
    const ad = formatText(document.getElementById('edm-ad').value);
    const bas = Number(document.getElementById('edm-bas').value);
    if (!ad) return toast('Ad boş olamaz');
    await kol('depo_malzemeler').doc(id).set({
        kod: document.getElementById('edm-kod').value.trim(),
        ad: ad,
        aciklama: formatText(document.getElementById('edm-aciklama').value),
        birim: document.getElementById('edm-birim').value.trim(),
        baslangic: bas
    }, { merge: true });
    if (eskiBas !== bas) {
        const n = nowTarih();
        await kol('stok_hareketleri').add({
            tarih: n.display, tarihISO: n.iso, saat: n.saat,
            bolum: 'Depo', islem: 'STOK GÜNCELLE', malzeme: ad,
            miktarDegisim: bas - eskiBas, aciklama: 'Stok: ' + eskiBas + ' → ' + bas, kullanici: kullaniciAdi()
        });
    }
    closeModal();
    toast('Güncellendi');
}

function depoMalzemeSil(id, ad) {
    appConfirm(`"${ad}" malzemesini silmek istediğinize emin misiniz?`, async () => {
        await kol('depo_malzemeler').doc(id).delete();
        toast('Malzeme silindi');
    });
}

function depoExcelYukleModal() {
    openModal('Excel\'den Toplu Depo Malzemesi Yükle', `<p class="text-xs text-gray-400 mb-2">Sütunlar: Kod, Ad, Birim, Açıklama, Başlangıç</p><input type="file" id="dm-excel" accept=".xlsx,.xls"><button class="btn btn-blue w-full mt-3" onclick="depoExcelYukle()">Yükle</button>`);
}

function depoExcelYukle() {
    const f = document.getElementById('dm-excel').files[0];
    if (!f) return toast('Dosya seçin');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!json.length) return toast('Veri yok');
        const mevcut = depoMalzemeler.map(m => trLower(m.ad));
        const batch = db.batch();
        let eklenen = 0;
        json.forEach(row => {
            const ad = formatText(String(row.Ad || row.ad || ''));
            if (!ad || mevcut.indexOf(trLower(ad)) > -1) return;
            batch.set(kol('depo_malzemeler').doc(), {
                ad: ad,
                kod: String(row.Kod || row.kod || ''),
                birim: String(row.Birim || row.birim || 'Adet'),
                aciklama: formatText(String(row.Aciklama || row.aciklama || '')),
                baslangic: Number(row.Baslangic || row.baslangic || 0)
            });
            mevcut.push(trLower(ad));
            eklenen++;
        });
        if (eklenen === 0) return toast('Eklenecek yeni malzeme yok');
        await batch.commit();
        closeModal();
        toast(eklenen + ' malzeme eklendi');
    };
    reader.readAsArrayBuffer(f);
}

// ===================== RAPOR =====================

function depoRenderRapor() {
    const hesap = depoHesaplanmis();
    let filtreli = depoHareketler.slice();
    if (depoHareketBas) filtreli = filtreli.filter(h => h.tarihISO >= depoHareketBas);
    if (depoHareketSon) filtreli = filtreli.filter(h => h.tarihISO <= depoHareketSon);
    filtreli.sort((a, b) => trKarsilastir(b.tarihISO + b.saat, a.tarihISO + a.saat));

    let rows = filtreli.map(h => `<tr><td>${esc(h.tarih)} ${esc(h.saat)}</td><td>${esc(h.islem)}</td><td>${esc(h.malzeme)}</td><td class="text-right">${h.miktarDegisim > 0 ? '+' : ''}${h.miktarDegisim}</td><td>${esc(h.aciklama || '')}</td></tr>`).join('');
    if (!rows) rows = '<tr><td colspan="5" class="muted">Hareket yok.</td></tr>';

    document.getElementById('depo-rapor').innerHTML = `
        <div class="card"><h3>Depo Özeti</h3><div class="dash-grid">
            <div class="dash-card"><div class="num text-blue-400">${hesap.length}</div><div class="lbl">Malzeme</div></div>
            <div class="dash-card"><div class="num text-green-400">${depoKayitlar.length}</div><div class="lbl">Çıkış Kaydı</div></div>
        </div></div>
        <div class="card"><div class="flex gap-2 flex-wrap items-center mb-2">
            <input type="date" id="depo-r-bas" value="${depoHareketBas}" style="width:140px" onchange="depoHareketBas=this.value;depoRenderRapor();">
            <span class="text-xs">—</span>
            <input type="date" id="depo-r-son" value="${depoHareketSon}" style="width:140px" onchange="depoHareketSon=this.value;depoRenderRapor();">
            <button class="btn btn-gray" onclick="depoHareketBas='';depoHareketSon='';depoRenderRapor();">Tümü</button>
            <button class="btn btn-red" onclick="depoPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
            <button class="btn btn-green" onclick="depoExcel()"><i class="fa-solid fa-file-excel"></i> Excel</button>
        </div></div>
        <div class="card" style="overflow:auto"><table><thead><tr><th>Tarih/Saat</th><th>İşlem</th><th>Malzeme</th><th class="text-right">Değişim</th><th>Açıklama</th></tr></thead><tbody>${rows}</tbody></table></div>
    `;
}

// Türkçe karakter destekli PDF
async function depoPdf() {
    toast('PDF hazırlanıyor...');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    try { await turkcePdfFontHazirla(doc); } catch (e) { console.error(e); }
    doc.text('Depo Hareketleri', 14, 15);
    const l = depoHareketler.slice().sort((a, b) => trKarsilastir(b.tarihISO + b.saat, a.tarihISO + a.saat));
    doc.autoTable({
        startY: 20,
        styles: { font: 'NotoSans', fontStyle: 'normal' },
        headStyles: { font: 'NotoSans', fontStyle: 'normal' },
        head: [['Tarih', 'Saat', 'İşlem', 'Malzeme', 'Değişim', 'Açıklama']],
        body: l.map(h => [h.tarih, h.saat, h.islem, h.malzeme, h.miktarDegisim, h.aciklama || ''])
    });
    doc.save('depo_hareketleri.pdf');
}

function depoExcel() {
    const l = depoHareketler.slice().sort((a, b) => trKarsilastir(b.tarihISO + b.saat, a.tarihISO + a.saat));
    const rows = [['Tarih', 'Saat', 'İşlem', 'Malzeme', 'Değişim', 'Açıklama']]
        .concat(l.map(h => [h.tarih, h.saat, h.islem, h.malzeme, h.miktarDegisim, h.aciklama || '']));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Depo');
    XLSX.writeFile(wb, 'depo_hareketleri.xlsx');
}
