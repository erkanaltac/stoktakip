// depo.js
// Depo Modülü

let depoMalzemeler = [];
let depoKayitlar = [];
let depoAdresler = [];
let depoHareketler = [];
let depoHareketBas = '';
let depoHareketSon = '';

function depoBaslat() {
    document.getElementById('depo-cikis').innerHTML = '<div class="muted">Yükleniyor...</div>';
    const un1 = db.collection('depo_malzemeler').onSnapshot(s => {
        depoMalzemeler = s.docs.map(d => ({ id: d.id, ...d.data() }));
        depoHesaplaVeCiz();
    });
    const un2 = db.collection('depo_kayitlari').onSnapshot(s => {
        depoKayitlar = s.docs.map(d => ({ id: d.id, ...d.data() }));
        depoHesaplaVeCiz();
    });
    const un3 = db.collection('adresler_alt').onSnapshot(s => {
        depoAdresler = uniq(depoAdresler.concat(s.docs.map(d => d.data().ad)));
    });
    const un4 = db.collection('adresler_ust').onSnapshot(s => {
        depoAdresler = uniq(depoAdresler.concat(s.docs.map(d => d.data().ad)));
    });
    const un5 = db.collection('stok_hareketleri').where('bolum', '==', 'Depo').onSnapshot(s => {
        depoHareketler = s.docs.map(d => ({ id: d.id, ...d.data() }));
        depoRenderRapor();
    });
    window.aktifListeners.push(un1, un2, un3, un4, un5);
    depoHareketBas = '';
    depoHareketSon = '';
    depoTabGoster('cikis');
}

function depoTabGoster(tab) {
    document.querySelectorAll('#depo-modulu .tab-btn').forEach(b =>
        b.classList.toggle('aktif', b.dataset.depotab === tab)
    );
    ['cikis', 'malzemeler', 'rapor'].forEach(t =>
        document.getElementById('depo-' + t).classList.toggle('gizli', t !== tab)
    );
    clearSearchInputs();
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

function depoHesaplaVeCiz() {
    depoRenderCikis();
    depoRenderMalzemeler();
}

function depoRenderCikis() {
    const sorted = depoKayitlar.slice().sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
    let rows = sorted.map(k => `<tr>
        <td class="mono">${esc(k.tarih)} ${esc(k.saat)}</td>
        <td>${esc(k.malzeme)}</td>
        <td class="text-right">${k.miktar}</td>
        <td><span class="clickable-text" onclick="depoAdresGecmis('${esc(k.adres).replace(/'/g, "\\'")}')">${esc(k.adres)}</span></td>
        <td class="hide-mobile">${esc(k.aciklama || '')}</td>
        <td class="text-right"><button class="icon-btn" onclick="depoKayitSil('${k.id}')"><i class="fa-solid fa-xmark"></i></button></td>
    </tr>`).join('');
    if (!rows) rows = '<tr><td colspan="6" class="muted">Henüz depo çıkışı yok.</td></tr>';

    document.getElementById('depo-cikis').innerHTML = `
        <div class="card"><h3>Depo Çıkışı</h3>
        <div class="grid3">
            <div class="suggest-wrap"><label class="f">Adres *</label><input id="depo-adres" autocomplete="off" oninput="depoAdresOneriGoster()" onfocus="depoAdresOneriGoster()"><div class="suggest-list" id="depo-adres-list"></div></div>
            <div class="suggest-wrap"><label class="f">Malzeme *</label><input id="depo-malzeme" autocomplete="off" oninput="depoMalzemeOneriGoster()" onfocus="depoMalzemeOneriGoster()"><div class="suggest-list" id="depo-malzeme-list"></div></div>
            <div><label class="f">Miktar *</label><input id="depo-miktar" type="number" min="1" step="1"></div>
            <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="depo-aciklama"></div>
            <div><button class="btn btn-blue w-full" id="depo-btn" onclick="depoCikisEkle()">Depodan Düş</button></div>
        </div></div>
        <div class="card" style="overflow:auto"><table><thead><tr><th>Tarih/Saat</th><th>Malzeme</th><th class="text-right">Miktar</th><th>Adres</th><th class="hide-mobile">Açıklama</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    `;
}

function depoAdresOneriGoster() {
    const val = trLower(document.getElementById('depo-adres').value.trim());
    const m = val ? depoAdresler.filter(a => trLower(a).indexOf(val) > -1) : depoAdresler.slice(0, 8);
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

async function depoCikisEkle() {
    const adres = document.getElementById('depo-adres').value.trim();
    const malzeme = document.getElementById('depo-malzeme').value.trim();
    const miktar = Number(document.getElementById('depo-miktar').value);
    const aciklama = document.getElementById('depo-aciklama').value.trim();
    if (!adres || !malzeme || !miktar) return toast('Tüm zorunlu alanları doldurun');
    if (!depoMalzemeler.some(m => trLower(m.ad) === trLower(malzeme))) return toast('Geçersiz malzeme');
    const n = nowTarih();
    await db.collection('depo_kayitlari').add({
        tarih: n.display, tarihISO: n.iso, saat: n.saat,
        malzeme, miktar, adres, aciklama, kullanici: kullaniciAdi()
    });
    await db.collection('stok_hareketleri').add({
        tarih: n.display, tarihISO: n.iso, saat: n.saat,
        bolum: 'Depo', islem: 'DEPO ÇIKIŞI', malzeme,
        miktarDegisim: -miktar, aciklama: 'Adres: ' + adres, kullanici: kullaniciAdi()
    });
    document.getElementById('depo-malzeme').value = '';
    document.getElementById('depo-miktar').value = '';
    document.getElementById('depo-adres').value = '';
    document.getElementById('depo-aciklama').value = '';
    toast('Depodan düşüldü');
}

function depoKayitSil(id) {
    const k = depoKayitlar.find(x => x.id === id);
    if (!k) return;
    appConfirm('Bu kaydı silmek istediğinizden emin misiniz? Miktar depo stoğuna geri eklenecek.', async () => {
        await db.collection('depo_kayitlari').doc(id).delete();
        const n = nowTarih();
        await db.collection('stok_hareketleri').add({
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
        .sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
    let rows = kayitlar.map(k => `<tr><td>${esc(k.tarih)} ${esc(k.saat)}</td><td>${esc(k.malzeme)}</td><td class="text-right">${k.miktar}</td><td>${esc(k.aciklama || '')}</td></tr>`).join('');
    openModal(`Depo - ${esc(adres)}`, `<table><thead><tr><th>Tarih/Saat</th><th>Malzeme</th><th class="text-right">Miktar</th><th>Açıklama</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok</td></tr>'}</tbody></table>`);
}

function depoMalzemeGecmis(malzemeAdi) {
    const kayitlar = depoKayitlar
        .filter(k => trLower(k.malzeme) === trLower(malzemeAdi))
        .sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
    let rows = kayitlar.map(k => `<tr><td>${esc(k.tarih)} ${esc(k.saat)}</td><td>${esc(k.adres)}</td><td class="text-right">${k.miktar}</td><td>${esc(k.aciklama || '')}</td></tr>`).join('');
    openModal(`Depo - ${esc(malzemeAdi)}`, `<table><thead><tr><th>Tarih/Saat</th><th>Adres</th><th class="text-right">Miktar</th><th>Açıklama</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Kayıt yok</td></tr>'}</tbody></table>`);
}

function depoRenderMalzemeler() {
    const list = depoHesaplanmis();
    let rows = list.map(m => `<tr>
        <td class="mono">${esc(m.kod || '')}</td>
        <td class="clickable-text" onclick="depoMalzemeGecmis('${esc(m.ad).replace(/'/g, "\\'")}')">${esc(m.ad)}</td>
        <td class="text-right">${m.baslangic}</td><td class="text-right">${m.kalan}</td><td>${durumBadge(m.durum)}</td>
        <td class="text-right"><button class="icon-btn" onclick="depoMalzemeDuzenle('${m.id}')"><i class="fa-solid fa-pen"></i></button> <button class="icon-btn" onclick="depoMalzemeSil('${m.id}','${esc(m.ad).replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash text-red-400"></i></button></td>
    </tr>`).join('');
    if (!rows) rows = '<tr><td colspan="6" class="muted">Henüz depo malzemesi yok.</td></tr>';
    document.getElementById('depo-malzemeler').innerHTML = `
        <div class="card"><div class="flex justify-between items-center"><h3>Depo Malzemeleri (${depoMalzemeler.length})</h3><div class="flex gap-2"><button class="btn btn-gray" onclick="depoExcelYukleModal()"><i class="fa-solid fa-file-excel"></i> Excel Yükle</button><button class="btn btn-blue" onclick="depoMalzemeEkleModal()">+ Malzeme Ekle</button></div></div></div>
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
    const ad = document.getElementById('dm-ad').value.trim();
    const bas = Number(document.getElementById('dm-bas').value);
    if (!ad || isNaN(bas)) return toast('Ad ve başlangıç stok gerekli');
    if (depoMalzemeler.some(m => trLower(m.ad) === trLower(ad))) return toast('Bu malzeme zaten var');
    await db.collection('depo_malzemeler').add({
        kod: document.getElementById('dm-kod').value.trim(),
        ad: ad,
        aciklama: document.getElementById('dm-aciklama').value.trim(),
        birim: document.getElementById('dm-birim').value.trim(),
        baslangic: bas
    });
    const n = nowTarih();
    await db.collection('stok_hareketleri').add({
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
    const ad = document.getElementById('edm-ad').value.trim();
    const bas = Number(document.getElementById('edm-bas').value);
    if (!ad) return toast('Ad boş olamaz');
    await db.collection('depo_malzemeler').doc(id).set({
        kod: document.getElementById('edm-kod').value.trim(),
        ad: ad,
        aciklama: document.getElementById('edm-aciklama').value.trim(),
        birim: document.getElementById('edm-birim').value.trim(),
        baslangic: bas
    }, { merge: true });
    if (eskiBas !== bas) {
        const n = nowTarih();
        await db.collection('stok_hareketleri').add({
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
        await db.collection('depo_malzemeler').doc(id).delete();
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
            const ad = String(row.Ad || row.ad || '').trim();
            if (!ad || mevcut.indexOf(trLower(ad)) > -1) return;
            batch.set(db.collection('depo_malzemeler').doc(), {
                ad: ad,
                kod: String(row.Kod || row.kod || ''),
                birim: String(row.Birim || row.birim || 'Adet'),
                aciklama: String(row.Aciklama || row.aciklama || ''),
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

function depoRenderRapor() {
    const hesap = depoHesaplanmis();
    let filtreli = depoHareketler.slice();
    if (depoHareketBas) filtreli = filtreli.filter(h => h.tarihISO >= depoHareketBas);
    if (depoHareketSon) filtreli = filtreli.filter(h => h.tarihISO <= depoHareketSon);
    filtreli.sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));

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

function depoPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Depo Hareketleri', 14, 15);
    const l = depoHareketler.slice().sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
    doc.autoTable({
        startY: 20,
        head: [['Tarih', 'Saat', 'Islem', 'Malzeme', 'Degisim', 'Aciklama']],
        body: l.map(h => [h.tarih, h.saat, h.islem, h.malzeme, h.miktarDegisim, h.aciklama || ''])
    });
    doc.save('depo_hareketleri.pdf');
}

function depoExcel() {
    const l = depoHareketler.slice().sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
    const rows = [['Tarih', 'Saat', 'İşlem', 'Malzeme', 'Değişim', 'Açıklama']]
        .concat(l.map(h => [h.tarih, h.saat, h.islem, h.malzeme, h.miktarDegisim, h.aciklama || '']));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Depo');
    XLSX.writeFile(wb, 'depo_hareketleri.xlsx');
}
