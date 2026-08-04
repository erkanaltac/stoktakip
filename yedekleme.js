// yedekleme.js – Düzeltilmiş Excel & JSON İndirme

const YEDEK_KOLEKSIYONLAR = [
    'kullanim_alt', 'kullanim_ust',
    'depo_kayitlari', 'depo_malzemeler',
    'ariza_kayitlari', 'kameralar',
    'adresler_alt', 'adresler_ust',
    'malzemeler_alt', 'malzemeler_ust',
    'stok_hareketleri'
];

let yedekListesi = [];

function yedeklemeBaslat() {
    if (!document.getElementById('yedek-liste')) return;
    document.getElementById('yedek-liste').innerHTML = '<div class="muted">Yükleniyor...</div>';
    const un = db.collection('yedekler')
        .where('kullaniciEmail', '==', window.aktifKullanici.email)
        .onSnapshot(function (s) {
            yedekListesi = s.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.tarihISO + b.saat).localeCompare(a.tarihISO + a.saat));
            yedeklemeListesiCiz();
        }, function (err) {
            console.error(err);
            document.getElementById('yedek-liste').innerHTML =
                '<div class="muted">Yedek listesi okunamadı.</div>';
        });
    window.aktifListeners.push(un);
}

function yedeklemeListesiCiz() {
    const el = document.getElementById('yedek-liste');
    if (!el) return;
    if (!yedekListesi.length) {
        el.innerHTML = '<div class="muted">Henüz yedek alınmamış.</div>';
        return;
    }
    el.innerHTML = yedekListesi.map(y => `
        <div class="card" style="padding:.6rem;margin-bottom:.5rem">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <div class="text-sm font-bold">${esc(y.tarih)} ${esc(y.saat)}</div>
                    <div class="text-xs text-gray-400">${y.kayitSayisi || 0} kayıt · ${esc(y.kullanici || '')}</div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-green" onclick="yedekExcelIndir('${y.id}')"><i class="fa-solid fa-file-excel"></i> Excel</button>
                    <button class="btn btn-gray" onclick="yedekJsonIndir('${y.id}')"><i class="fa-solid fa-download"></i> JSON</button>
                    <button class="btn btn-blue" onclick="yedekGeriYukleOnay('${y.id}')"><i class="fa-solid fa-rotate-left"></i> Geri Yükle</button>
                    <button class="icon-btn" onclick="yedekSil('${y.id}')"><i class="fa-solid fa-trash text-red-400"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

// ---- Yeni yedek al ----
function yedekAl() {
    appConfirm(
        'Tüm sistem verilerinin yedeği alınacak. Devam edilsin mi?',
        async function () {
            toast('Yedek alınıyor...');
            try {
                const veri = {};
                let toplam = 0;
                for (const col of YEDEK_KOLEKSIYONLAR) {
                    const snap = await db.collection(col).get();
                    veri[col] = snap.docs.map(d => {
                        const data = d.data();
                        data._id = d.id;
                        return data;
                    });
                    toplam += veri[col].length;
                }
                const n = nowTarih();
                await db.collection('yedekler').add({
                    kullaniciEmail: window.aktifKullanici.email,
                    kullanici: kullaniciAdi(),
                    tarih: n.display, tarihISO: n.iso, saat: n.saat,
                    kayitSayisi: toplam,
                    veri: veri
                });
                toast('Yedek alındı: ' + toplam + ' kayıt');
            } catch (e) {
                appAlert('Yedekleme hatası: ' + e.message);
            }
        },
        'Yedek Al'
    );
}

// ==================== EXCEL İNDİRME  ====================
function yedekExcelIndir(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y || !y.veri) return toast('Yedek verisi bulunamadı');

    try {
        const wb = XLSX.utils.book_new();

        // HER KOLEKSİYON İÇİN AYRI SAYFA
        for (const col of YEDEK_KOLEKSIYONLAR) {
            const kayitlar = y.veri[col] || [];

            // --- SÜTUN BAŞLIKLARINI BELİRLE ---
            let basliklar = [];

            if (kayitlar.length > 0) {
                // Veri varsa: tüm benzersiz alan adlarını topla
                const tumAlanlar = new Set();
                kayitlar.forEach(k => {
                    Object.keys(k).forEach(a => tumAlanlar.add(a));
                });
                basliklar = ['_id'];
                Array.from(tumAlanlar)
                    .filter(a => a !== '_id')
                    .sort()
                    .forEach(a => basliklar.push(a));
            } else {
                // Veri yoksa: koleksiyon adına göre bilinen başlıkları kullan
                basliklar = koleksiyonBasliklari(col);
            }

            // --- VERİ SATIRLARINI OLUŞTUR ---
            const satirlar = [];

            // Başlık satırını ekle (her zaman)
            satirlar.push(basliklar);

            // Veri satırlarını ekle
            kayitlar.forEach(k => {
                const satir = basliklar.map(b => {
                    const val = k[b];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'object') return JSON.stringify(val);
                    return val;
                });
                satirlar.push(satir);
            });

            // Sayfayı oluştur ve çalışma kitabına ekle
            const ws = XLSX.utils.aoa_to_sheet(satirlar);

            // Sütun genişliklerini otomatik ayarla (opsiyonel)
            const maxGenislik = basliklar.map((b, i) => {
                let max = b.length;
                satirlar.forEach(s => {
                    const val = String(s[i] || '');
                    if (val.length > max) max = val.length;
                });
                return { wch: Math.min(max + 2, 50) }; // max 50 karakter genişlik
            });
            ws['!cols'] = maxGenislik;

            const sheetName = col.length > 31 ? col.substring(0, 28) + '...' : col;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // DOSYAYI İNDİR
        const dosyaAdi = 'stok_yedek_' + y.tarihISO + '_' + y.saat.replace(':', '') + '.xlsx';
        XLSX.writeFile(wb, dosyaAdi);
        toast('Excel dosyası indirildi (' + YEDEK_KOLEKSIYONLAR.length + ' sayfa)');
    } catch (e) {
        console.error('Excel hatası:', e);
        appAlert('Excel oluşturma hatası: ' + e.message);
    }
}

// ==================== KOLEKSİYONLARA GÖRE BİLİNEN BAŞLIKLAR ====================
function koleksiyonBasliklari(col) {
    const sablonlar = {
        'kullanim_alt': ['_id', 'aciklama', 'adres', 'kullanici', 'malzeme', 'miktar', 'saat', 'tarih', 'tarihISO'],
        'kullanim_ust': ['_id', 'aciklama', 'adres', 'kullanici', 'malzeme', 'miktar', 'saat', 'tarih', 'tarihISO'],
        'depo_kayitlari': ['_id', 'aciklama', 'adres', 'kullanici', 'malzeme', 'miktar', 'saat', 'tarih', 'tarihISO'],
        'depo_malzemeler': ['_id', 'aciklama', 'ad', 'baslangic', 'birim', 'kod'],
        'ariza_kayitlari': ['_id', 'aciklama', 'adres', 'adet', 'bolum', 'durum', 'hedefTarih', 'kullanici', 'parcalar', 'saat', 'tamamlanmaTarihi', 'tarih', 'tarihISO'],
        'kameralar': ['_id', 'aciklama', 'adres', 'ip', 'nvrIp', 'seriNo', 'simkart', 'telefon'],
        'adresler_alt': ['_id', 'adres', 'mahalle', 'onay'],
        'adresler_ust': ['_id', 'adres', 'mahalle', 'onay'],
        'malzemeler_alt': ['_id', 'aciklama', 'ad', 'baslangic', 'birim', 'kod'],
        'malzemeler_ust': ['_id', 'aciklama', 'ad', 'baslangic', 'birim', 'kod'],
        'stok_hareketleri': ['_id', 'aciklama', 'bolum', 'islem', 'kullanici', 'malzeme', 'miktarDegisim', 'saat', 'tarih', 'tarihISO']
    };

    return sablonlar[col] || ['_id', 'veri']; // Bilinmeyen koleksiyon için varsayılan
}

// ==================== JSON İNDİRME (DÜZELTİLDİ) ====================
function yedekJsonIndir(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y || !y.veri) return toast('Yedek verisi bulunamadı');

    try {
        const paket = {
            stokSistemiYedek: true,
            olusturmaTarihi: y.tarih + ' ' + y.saat,
            kullanici: y.kullanici,
            kayitSayisi: y.kayitSayisi,
            veri: y.veri
        };
        const jsonStr = JSON.stringify(paket, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stok_yedek_' + y.tarihISO + '_' + y.saat.replace(':', '') + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('JSON dosyası indirildi');
    } catch (e) {
        appAlert('JSON oluşturma hatası: ' + e.message);
    }
}


function yedekDosyadanYukleModal() {
    openModal('JSON Dosyasından Geri Yükle', `
        <p class="text-xs text-gray-400 mb-2">Daha önce indirdiğiniz .json yedek dosyasını seçin.</p>
        <input type="file" id="yedek-dosya" accept=".json,application/json">
        <button class="btn btn-red w-full mt-3" onclick="yedekDosyadanGeriYukle()">Bu Dosyadan Geri Yükle</button>
    `);
}

function yedekDosyadanGeriYukle() {
    const f = document.getElementById('yedek-dosya').files[0];
    if (!f) return toast('Dosya seçin');
    const reader = new FileReader();
    reader.onload = function (e) {
        let paket;
        try {
            paket = JSON.parse(e.target.result);
        } catch (err) {
            return appAlert('Geçersiz dosya formatı.');
        }
        if (!paket || !paket.veri) return appAlert('Bu bir yedek dosyası değil.');
        closeModal();
        appConfirm(
            'Bu yedek geri yüklenecek. Mevcut veriler silinecek!',
            function () { yedekVeriyiGeriYukle(paket.veri); },
            'Geri Yükle'
        );
    };
    reader.readAsText(f);
}

function yedekGeriYukleOnay(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y) return;
    appConfirm(
        y.tarih + ' ' + y.saat + ' tarihli yedek geri yüklenecek.',
        function () { yedekVeriyiGeriYukle(y.veri); },
        'Geri Yükle'
    );
}

async function yedekVeriyiGeriYukle(veri) {
    toast('Geri yükleniyor...');
    try {
        for (const col of YEDEK_KOLEKSIYONLAR) {
            // 1) Mevcut koleksiyonu temizle
            const mevcut = await kol(col).get();
            const silBatch = db.batch();
            mevcut.docs.forEach(d => silBatch.delete(d.ref));
            await silBatch.commit();

            // 2) Yedekteki kayıtları yaz
            const kayitlar = veri[col] || [];
            for (let i = 0; i < kayitlar.length; i += 400) {
                const batch = db.batch();
                kayitlar.slice(i, i + 400).forEach(k => {
                    const ref = k._id ? kol(col).doc(k._id) : kol(col).doc();
                    const kopya = { ...k };
                    delete kopya._id;
                    batch.set(ref, kopya);
                });
                await batch.commit();
            }
        }
        toast('Geri yükleme tamamlandı');
    } catch (e) {
        appAlert('Hata: ' + e.message);
    }
}

function yedekSil(id) {
    appConfirm('Bu yedek silinecek. Onaylıyor musunuz?', async function () {
        await db.collection('yedekler').doc(id).delete();
        toast('Yedek silindi');
    });
}
