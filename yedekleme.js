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

// ==================== EXCEL İNDİRME (DÜZELTİLDİ) ====================
function yedekExcelIndir(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y || !y.veri) return toast('Yedek verisi bulunamadı');

    try {
        // YENİ BİR ÇALIŞMA KİTABI OLUŞTUR
        const wb = XLSX.utils.book_new();

        // HER KOLEKSİYON İÇİN AYRI SAYFA
        for (const col of YEDEK_KOLEKSIYONLAR) {
            const kayitlar = y.veri[col] || [];
            
            // Boş koleksiyonlar için de sayfa oluşturalım ki eksiklik belli olsun
            if (kayitlar.length === 0) {
                const bosSayfa = XLSX.utils.aoa_to_sheet([['Bu koleksiyonda veri yok']]);
                const sheetName = col.length > 31 ? col.substring(0, 28) + '...' : col;
                XLSX.utils.book_append_sheet(wb, bosSayfa, sheetName);
                continue;
            }

            // Tüm benzersiz alan adlarını topla
            const tumAlanlar = new Set();
            kayitlar.forEach(k => {
                Object.keys(k).forEach(a => tumAlanlar.add(a));
            });

            // Sütun başlıkları: _id en başta, diğerleri alfabetik
            const basliklar = ['_id'];
            Array.from(tumAlanlar)
                .filter(a => a !== '_id')
                .sort()
                .forEach(a => basliklar.push(a));

            // Veri satırlarını oluştur
            const satirlar = kayitlar.map(k => 
                basliklar.map(b => {
                    const val = k[b];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'object') return JSON.stringify(val);
                    return val;
                })
            );

            // Başlık satırını en başa ekle
            satirlar.unshift(basliklar);

            // Sayfayı oluştur ve çalışma kitabına ekle
            const ws = XLSX.utils.aoa_to_sheet(satirlar);
            const sheetName = col.length > 31 ? col.substring(0, 28) + '...' : col;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // DOSYAYI İNDİR
        const dosyaAdi = 'stok_yedek_' + y.tarihISO + '_' + y.saat.replace(':', '') + '.xlsx';
        XLSX.writeFile(wb, dosyaAdi);
        toast('Excel dosyası indirildi (' + Object.keys(y.veri).length + ' sayfa)');
    } catch (e) {
        console.error('Excel hatası:', e);
        appAlert('Excel oluşturma hatası: ' + e.message);
    }
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

// ---- Geri yükleme fonksiyonları aynı kalacak (önceki sürümdeki gibi) ----
// yedekDosyadanYukleModal, yedekDosyadanGeriYukle,
// yedekGeriYukleOnay, yedekVeriyiGeriYukle, yedekBatchUygula, yedekSil
// ... (önceki sürümdeki kodları buraya ekleyin)

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
            const mevcut = await db.collection(col).get();
            const silBatch = db.batch();
            mevcut.docs.forEach(d => silBatch.delete(d.ref));
            await silBatch.commit();

            const kayitlar = veri[col] || [];
            for (let i = 0; i < kayitlar.length; i += 400) {
                const batch = db.batch();
                kayitlar.slice(i, i + 400).forEach(k => {
                    const ref = k._id ? db.collection(col).doc(k._id) : db.collection(col).doc();
                    const veriKopya = { ...k };
                    delete veriKopya._id;
                    batch.set(ref, veriKopya);
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
