// ayarlar.js – Ayarlar Modülü

// Veri Silme
async function veriSilmeOnay() {
    const sifre = document.getElementById('veri-sil-sifre').value;
    if (!sifre) return toast('Lütfen şifrenizi girin.');

    auth.signInWithEmailAndPassword(window.aktifKullanici.email, sifre)
        .then(() => {
            const secili = [];
            document.querySelectorAll('.veri-sil-check:checked').forEach(cb => secili.push(cb.value));
            if (secili.length === 0) return toast('Hiçbir veri türü seçilmedi.');

            appConfirm(
                'SADECE SİZE AİT veriler silinecek. Bu işlem geri alınamaz!',
                async () => {
                    try {
                        const mevcutKullanici = kullaniciAdi();
                        for (const col of secili) {
                            const snap = await kol(col).where('kullanici', '==', mevcutKullanici).get();
                            const batch = db.batch();
                            snap.docs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                        }
                        toast('Kendi verileriniz silindi.');
                    } catch (e) {
                        appAlert('Silme hatası: ' + e.message);
                    }
                },
                'Veri Sil'
            );
        })
        .catch(() => toast('Şifre yanlış!'));
}

// Fabrika Ayarları
async function fabrikaAyarlari() {
    const sifre = document.getElementById('veri-sil-sifre').value;
    if (!sifre) return toast('Lütfen şifrenizi girin.');

    auth.signInWithEmailAndPassword(window.aktifKullanici.email, sifre)
        .then(() => {
            appConfirm(
                'SADECE SİZE AİT TÜM VERİLER SİLİNECEK! Bu işlem geri alınamaz.',
                async () => {
                    try {
                        const mevcutKullanici = kullaniciAdi();
                        const collections = [
                            'kullanim_alt', 'kullanim_ust',
                            'depo_kayitlari', 'ariza_kayitlari', 'kameralar',
                            'adresler_alt', 'adresler_ust',
                            'malzemeler_alt', 'malzemeler_ust',
                            'depo_malzemeler', 'stok_hareketleri'
                        ];
                        for (const col of collections) {
                            const snap = await kol(col).where('kullanici', '==', mevcutKullanici).get();
                            const batch = db.batch();
                            snap.docs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                        }
                        toast('Size ait tüm veriler silindi.');
                    } catch (e) {
                        appAlert('Hata: ' + e.message);
                    }
                },
                'Fabrika Ayarları'
            );
        })
        .catch(() => toast('Şifre yanlış!'));
}

// Şifre Taleplerini Göster (SADECE ERKAN GÖRÜR)
function sifreTalepleriniBaslat() {
    var el = document.getElementById('sifre-talepleri');
    if (!el) return;

    // SADECE ERKAN GÖREBİLİR
    if (kullaniciAdi() !== 'erkan') {
        el.innerHTML = '';
        return;
    }

    el.innerHTML = '<div class="muted">Yükleniyor...</div>';

    Promise.all([
        db.collection('kullaniciSifreleri').get(),
        db.collection('sifreTalepleri').get()
    ]).then(function (results) {
        var sifreSnap = results[0];
        var talepSnap = results[1];

        var sifreler = {};
        sifreSnap.docs.forEach(function (d) {
            sifreler[d.id] = d.data().sifre || '?';
        });

        var talepler = talepSnap.docs.map(function (d) {
            return { id: d.id, d: d.data() };
        }).map(function (t) {
            return {
                id: t.id,
                kullanici: t.d.kullanici || '',
                tarih: t.d.tarih || '',
                tarihISO: t.d.tarihISO || '',
                saat: t.d.saat || '',
                durum: t.d.durum || 'bekliyor'
            };
        });

        talepler.sort(function (a, b) {
            if (a.tarihISO !== b.tarihISO) return b.tarihISO.localeCompare(a.tarihISO);
            return b.saat.localeCompare(a.saat);
        });

        var html = '';
        if (talepler.length === 0) {
            html = '<div class="muted">Bekleyen talep yok.</div>';
        } else {
            talepler.forEach(function (t) {
                var sifre = sifreler[t.kullanici] || 'Henüz giriş yapmadı';
                html += '<div class="card" style="padding:.5rem;margin-bottom:.4rem;">';
                html += '<div class="flex justify-between items-center flex-wrap gap-2">';
                html += '<div class="text-xs">';
                html += '<b>' + esc(t.kullanici) + '</b>';
                html += '<span class="text-gray-400 ml-1">' + t.tarih + ' ' + t.saat + '</span>';
                html += '<br>';
                html += '<span class="text-green-400">Şifre: ' + esc(sifre) + '</span>';
                html += '<span class="text-yellow-400 ml-2">[' + t.durum + ']</span>';
                html += '</div>';
                html += '<div class="flex gap-2">';
                html += '<button class="btn btn-red" style="padding:.2rem .5rem;font-size:10px;" onclick="sifreTalebiSil(\'' + t.id + '\')">';
                html += '<i class="fa-solid fa-trash"></i> Sil';
                html += '</button>';
                html += '<a href="https://console.firebase.google.com/project/stoktakipp/authentication/users" target="_blank" class="btn btn-gray" style="padding:.2rem .5rem;font-size:10px;">';
                html += '<i class="fa-solid fa-key"></i> Firebase';
                html += '</a>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
            });
        }
        el.innerHTML = html;
    }).catch(function (err) {
        console.error('Talep okuma hatası:', err);
        el.innerHTML = '<div class="muted">Talepler okunamadı: ' + err.message + '</div>';
    });
}

// Talep Silme
function sifreTalebiSil(id) {
    appConfirm('Bu talebi silmek istediğinize emin misiniz?', function () {
        db.collection('sifreTalepleri').doc(id).delete().then(function () {
            toast('Talep silindi');
            sifreTalepleriniBaslat();
        }).catch(function (e) {
            toast('Silme hatası: ' + e.message);
        });
    }, 'Talep Sil');
}
