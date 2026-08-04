// kamera.js – Kamera Modülü
let kameralar = [];

function kameraBaslat(){
  document.getElementById('kamera-liste').innerHTML = '<div class="muted">Yükleniyor...</div>';
  document.getElementById('kamera-ara').value = '';
  const un = db.collection('kameralar').onSnapshot(s => { kameralar = s.docs.map(d => ({ id: d.id, ...d.data() })); renderKameraListesi(); });
  window.aktifListeners.push(un);
}

function renderKameraListesi(){
  const q = trLower(document.getElementById('kamera-ara').value.trim());
  const list = kameralar.filter(k => !q || trLower(k.adres + ' ' + k.ip + ' ' + (k.aciklama || '')).indexOf(q) > -1).sort((a, b) => a.adres.localeCompare(b.adres, 'tr'));
  var html = list.map(k => `<div class="kamera-row flex items-center gap-2">
    <span class="text-blue-300 cursor-pointer flex-1" onclick="kameraDetay('${k.id}')">${esc(k.adres)}</span>
    <span class="text-gray-400 flex-1 mono">${esc(k.ip || '-')}</span>
    <span class="text-gray-400 flex-1 hide-mobile">${esc(k.aciklama || '-')}</span>
    <button class="icon-btn" onclick="kameraDuzenleModal('${k.id}')"><i class="fa-solid fa-pen"></i></button>
    <button class="icon-btn" onclick="kameraSil('${k.id}')"><i class="fa-solid fa-trash text-red-400"></i></button>
  </div>`).join('');
  document.getElementById('kamera-liste').innerHTML = html || '<div class="muted">Henüz kamera eklenmemiş.</div>';
}

function kameraDetay(id) {
    const k = kameralar.find(x => x.id === id);
    if (!k) return;
    openModal(k.adres, `<div class="text-sm leading-7">
        <b>Adres:</b> ${esc(k.adres)}<br>
        <b>Telefon:</b> ${esc(k.telefon || '-')}<br>
        <b>Seri No:</b> ${esc(k.seriNo || '-')}<br>
        <b>IP:</b> ${esc(k.ip || '-')}<br>
        <b>NVR IP:</b> ${esc(k.nvrIp || '-')}<br>
        <b>Simkart No:</b> ${esc(k.simkart || '-')}<br>
        <b>Açıklama:</b> ${esc(k.aciklama || '-')}
    </div>`);
}

function kameraFormAlanlari(k){
  k = k || {adres:'',telefon:'',seriNo:'',ip:'',nvrIp:'',simkart:'',aciklama:''};
  return `<div class="grid3">
    <div><label class="f">Adres *</label><input id="ka-adres" value="${esc(k.adres)}"></div>
    <div><label class="f">Telefon</label><input id="ka-telefon" value="${esc(k.telefon)}"></div>
    <div><label class="f">Seri No</label><input id="ka-seriNo" value="${esc(k.seriNo)}"></div>
    <div><label class="f">IP</label><input id="ka-ip" value="${esc(k.ip)}"></div>
    <div><label class="f">NVR IP</label><input id="ka-nvrIp" value="${esc(k.nvrIp)}"></div>
    <div><label class="f">Simkart No</label><input id="ka-simkart" value="${esc(k.simkart)}"></div>
    <div style="grid-column:1/-1"><label class="f">Açıklama</label><input id="ka-aciklama" value="${esc(k.aciklama)}"></div>
  </div>`;
}

function openKameraAddModal(){ openModal('Kamera Ekle', kameraFormAlanlari()+'<button class="btn btn-blue w-full mt-3" onclick="kameraKaydet()">Kaydet</button>'); }

function kameraFormOku(){
  return {
    adres: formatText(document.getElementById('ka-adres').value),
    telefon: document.getElementById('ka-telefon').value.trim(),
    seriNo: document.getElementById('ka-seriNo').value.trim(),
    ip: document.getElementById('ka-ip').value.trim(),
    nvrIp: document.getElementById('ka-nvrIp').value.trim(),
    simkart: document.getElementById('ka-simkart').value.trim(),
    aciklama: formatText(document.getElementById('ka-aciklama').value)
  };
}

async function kameraKaydet(){ const d=kameraFormOku(); if(!d.adres){toast('Adres girin');return;} d.kullanici = kullaniciAdi(); await db.collection('kameralar').add(d); closeModal(); toast('Kamera eklendi'); }
function kameraDuzenleModal(id){ const k=kameralar.find(x=>x.id===id); if(!k)return; openModal('Kamera Düzenle', kameraFormAlanlari(k)+'<button class="btn btn-blue w-full mt-3" onclick="kameraGuncelle(\''+id+'\')">Kaydet</button>'); }
async function kameraGuncelle(id){ const d=kameraFormOku(); if(!d.adres){toast('Adres girin');return;} await db.collection('kameralar').doc(id).set(d,{merge:true}); closeModal(); toast('Güncellendi'); }
function kameraSil(id){ appConfirm('Bu kamerayı silmek istediğinizden emin misiniz?', async ()=>{ await db.collection('kameralar').doc(id).delete(); toast('Silindi'); }, 'Kamerayı Sil'); }

function kameraExcelYukleModal() {
    openModal('Excel\'den Kamera Yükle', `
        <p class="text-xs text-gray-400 mb-2">Sütun sırası: Adres, Telefon, Seri No, IP, NVR IP, Simkart No, Açıklama</p>
        <input type="file" id="ka-excel" accept=".xlsx,.xls">
        <button class="btn btn-blue w-full mt-3" onclick="kameraExcelYukle()">Yükle</button>
    `);
}

async function kameraExcelYukle() {
    const f = document.getElementById('ka-excel').files[0];
    if (!f) return toast('Dosya seçin');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        if (json.length < 2) return toast('Veri yok');

        // Mevcut kameraların adreslerini Set'e al (büyük/küçük harf duyarsız)
        const mevcutAdresler = new Set(kameralar.map(k => trLower(k.adres || '')));
        const batch = db.batch();
        let eklenen = 0;

        for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row || !row[0]) continue;
            const adres = String(row[0] || '').trim();
            if (!adres) continue;

            // Aynı adres var mı kontrol et (büyük/küçük harf duyarsız)
            if (mevcutAdresler.has(trLower(adres))) continue;

            batch.set(kol('kameralar').doc(), {
                adres: formatText(adres),
                telefon: String(row[1] || ''),
                seriNo: String(row[2] || ''),
                ip: String(row[3] || ''),
                nvrIp: String(row[4] || ''),
                simkart: String(row[5] || ''),
                aciklama: String(row[6] || '')
                kullanici: kullaniciAdi()
            });
            mevcutAdresler.add(trLower(adres));
            eklenen++;
        }

        if (eklenen === 0) return toast('Eklenecek yeni kamera yok (hepsi zaten mevcut).');
        await batch.commit();
        closeModal();
        toast(eklenen + ' yeni kamera eklendi');
    };
    reader.readAsArrayBuffer(f);
}
