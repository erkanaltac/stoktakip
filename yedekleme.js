// yedekleme.js
// Kullanıcı Bazlı Yedekleme ve Geri Yükleme Sistemi (Excel İndirme Özellikli)

const YEDEK_KOLEKSIYONLAR = [
    'kullanim_alt', 'kullanim_ust',
    'depo_kayitlari', 'depo_malzemeler',
    'ariza_kayitlari', 'kameralar',
    'adresler_alt', 'adresler_ust',
    'malzemeler_alt', 'malzemeler_ust',
    'stok_hareketleri'
];

let yedekListesi = [];

// ---- Ayarlar ekranı açıldığında çağrılır ----
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
                '<div class="muted">Yedek listesi okunamadı. (Firestore güvenlik kurallarında "yedekler" koleksiyonuna izin verildiğinden emin olun.)</div>';
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
                    <button class="btn btn-gray" onclick="yedekIndir('${y.id}')"><i class="fa-solid fa-download"></i> JSON</button>
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
        'Tüm sistem verilerinin (kullanım, arıza, kamera, depo, adres, malzeme ve hareket kayıtlarının) yeni bir yedeği alınacak. Devam edilsin mi?',
        async function () {
            toast('Yedek alınıyor, lütfen bekleyin...');
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

// ---- EXCEL olarak indir (HER KOLEKSİYON AYRI SAYFA) ----
function yedekExcelIndir(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y || !y.veri) return toast('Yedek verisi bulunamadı');

    try {
        const wb = XLSX.utils.book_new();

        for (const col of YEDEK_KOLEKSIYONLAR) {
            const kayitlar = y.veri[col] || [];
            if (kayitlar.length === 0) continue;

            // Sütun başlıklarını oluştur (_id dahil tüm alanlar)
            const tumAlanlar = new Set();
            kayitlar.forEach(k => Object.keys(k).forEach(a => tumAlanlar.add(a)));
            const basliklar = ['_id', ...Array.from(tumAlanlar).filter(a => a !== '_id')];

            const satirlar = kayitlar.map(k => basliklar.map(b => {
                const val = k[b];
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                return val;
            }));

            // Başlık satırını ekle
            satirlar.unshift(basliklar);

            const ws = XLSX.utils.aoa_to_sheet(satirlar);
            // Sayfa adı en fazla 31 karakter olabilir
            const sheetName = col.length > 31 ? col.substring(0, 28) + '...' : col;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const dosyaAdi = 'stok_yedek_' + y.tarihISO + '_' + y.saat.replace(':', '') + '.xlsx';
        XLSX.writeFile(wb, dosyaAdi);
        toast('Excel yedek dosyası indirildi');
    } catch (e) {
        appAlert('Excel oluşturma hatası: ' + e.message);
    }
}

// ---- Excel dosyasından geri yükleme ----
function yedekExceldenYukleModal() {
    openModal('Excel\'den Geri Yükle', `
        <p class="text-xs text-gray-400 mb-2">Daha önce "Excel İndir" ile kaydettiğiniz .xlsx yedek dosyasını seçin.</p>
        <input type="file" id="yedek-excel-dosya" accept=".xlsx,.xls">
        <button class="btn btn-red w-full mt-3" onclick="yedekExceldenGeriYukle()">Bu Excel Dosyasından Geri Yükle</button>
    `);
}

function yedekExceldenGeriYukle() {
    const f = document.getElementById('yedek-excel-dosya').files[0];
    if (!f) return toast('Dosya seçin');
    const reader = new FileReader();
    reader.onload = function (e) {
        let wb;
        try {
            wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        } catch (err) {
            return appAlert('Dosya okunamadı. Geçerli bir Excel (.xlsx) dosyası değil.');
        }

        const veri = {};
        let toplamKayit = 0;

        for (const sheetName of wb.SheetNames) {
            if (!YEDEK_KOLEKSIYONLAR.includes(sheetName) && !YEDEK_KOLEKSIYONLAR.some(c => sheetName.startsWith(c.substring(0, 28)))) {
                continue; // Tanınmayan sayfayı atla
            }

            // Gerçek koleksiyon adını bul
            let gercekKoleksiyon = sheetName;
            if (sheetName.endsWith('...')) {
                gercekKoleksiyon = YEDEK_KOLEKSIYONLAR.find(c => c.startsWith(sheetName.substring(0, 28)));
                if (!gercekKoleksiyon) continue;
            }

            const ws = wb.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (!json.length) continue;

            const basliklar = json[0];
            const kayitlar = [];

            for (let i = 1; i < json.length; i++) {
                const row = json[i];
                const kayit = {};
                basliklar.forEach((h, idx) => {
                    if (row[idx] !== undefined && row[idx] !== '') {
                        kayit[h] = row[idx];
                    }
                });
                if (Object.keys(kayit).length > 0) {
                    kayitlar.push(kayit);
                }
            }

            if (kayitlar.length > 0) {
                veri[gercekKoleksiyon] = kayitlar;
                toplamKayit += kayitlar.length;
            }
        }

        if (toplamKayit === 0) return appAlert('Excel dosyasında geri yüklenecek veri bulunamadı.');
        closeModal();
        appConfirm(
            'Excel dosyasından ' + toplamKayit + ' kayıt geri yüklenecek. ' +
            '<b>Mevcut tüm veriler bu yedekle değiştirilecek ve bu işlem geri alınamaz!</b> Devam edilsin mi?',
            function () { yedekVeriyiGeriYukle(veri); },
            'Excel\'den Geri Yükle'
        );
    };
    reader.readAsArrayBuffer(f);
}

// ---- Yedeği .json dosyası olarak cihaza indir ----
function yedekJsonUret(y) {
    const paket = {
        stokSistemiYedek: true,
        olusturmaTarihi: y.tarih + ' ' + y.saat,
        kullanici: y.kullanici,
        kayitSayisi: y.kayitSayisi,
        veri: y.veri
    };
    return JSON.stringify(paket, null, 2);
}

function yedekIndir(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y) return;
    const blob = new Blob([yedekJsonUret(y)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stok_yedek_' + y.tarihISO + '_' + y.saat.replace(':', '') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('JSON yedek dosyası indirildi');
}

// ---- Bilgisayardan .json yedek dosyası seçip geri yükleme ----
function yedekDosyadanYukleModal() {
    openModal('Dosyadan Geri Yükle (JSON)', `
        <p class="text-xs text-gray-400 mb-2">Daha önce "JSON İndir" ile kaydettiğiniz .json yedek dosyasını seçin.</p>
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
            return appAlert('Dosya okunamadı. Geçerli bir yedek (.json) dosyası değil.');
        }
        if (!paket || !paket.veri) {
            return appAlert('Dosya formatı tanınmadı. Bu sistemden alınmış bir yedek dosyası seçtiğinizden emin olun.');
        }
        closeModal();
        appConfirm(
            (paket.olusturmaTarihi || 'Bilinmeyen tarih') + ' tarihli dosyadan geri yükleme yapılacak. ' +
            '<b>Mevcut tüm veriler bu yedekle değiştirilecek ve bu işlem geri alınamaz!</b> Devam edilsin mi?',
            function () { yedekVeriyiGeriYukle(paket.veri); },
            'Dosyadan Geri Yükle'
        );
    };
    reader.readAsText(f);
}

// ---- Veritabanındaki bir yedeği geri yükleme onayı ----
function yedekGeriYukleOnay(id) {
    const y = yedekListesi.find(x => x.id === id);
    if (!y) return;
    appConfirm(
        (y.tarih + ' ' + y.saat) + ' tarihli yedek geri yüklenecek. ' +
        '<b>Mevcut tüm veriler bu yedekle değiştirilecek ve bu işlem geri alınamaz!</b> Devam edilsin mi?',
        function () { yedekVeriyiGeriYukle(y.veri); },
        'Geri Yükle'
    );
}

// ---- Ortak geri yükleme motoru ----
async function yedekVeriyiGeriYukle(veri) {
    toast('Geri yükleniyor, lütfen bekleyin... (sayfayı kapatmayın)');
    try {
        const kolonlar = Object.keys(veri).filter(k => YEDEK_KOLEKSIYONLAR.includes(k));
        for (const col of kolonlar) {
            // 1) Mevcut koleksiyonu temizle
            const mevcut = await db.collection(col).get();
            const silmeIslemleri = mevcut.docs.map(d => ({ tip: 'sil', ref: d.ref }));
            await yedekBatchUygula(silmeIslemleri);

            // 2) Yedekteki kayıtları aynı ID ile geri yaz
            const kayitlar = veri[col] || [];
            const yazmaIslemleri = kayitlar.map(k => {
                const kopya = Object.assign({}, k);
                const belgeId = kopya._id;
                delete kopya._id;
                const ref = belgeId ? db.collection(col).doc(belgeId) : db.collection(col).doc();
                return { tip: 'yaz', ref: ref, alanlar: kopya };
            });
            await yedekBatchUygula(yazmaIslemleri);
        }
        toast('Geri yükleme tamamlandı');
    } catch (e) {
        appAlert('Geri yükleme hatası: ' + e.message);
    }
}

// Firestore 500 işlem/batch sınırına uygun toplu işlem yardımcı fonksiyonu
async function yedekBatchUygula(islemler) {
    const PARCA = 400;
    for (let i = 0; i < islemler.length; i += PARCA) {
        const parca = islemler.slice(i, i + PARCA);
        const batch = db.batch();
        parca.forEach(function (op) {
            if (op.tip === 'sil') batch.delete(op.ref);
            else batch.set(op.ref, op.alanlar);
        });
        await batch.commit();
    }
}

function yedekSil(id) {
    appConfirm('Bu yedek kaydı (sadece kayıt, canlı verileriniz değil) silinecek. Onaylıyor musunuz?', async function () {
        await db.collection('yedekler').doc(id).delete();
        toast('Yedek kaydı silindi');
    });
}
