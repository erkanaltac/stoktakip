// ayarlar.js - Sadece kendi verilerini silme
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

function sifreTalepleriniBaslat() {
    if (!document.getElementById('sifre-talepleri')) return;
    const un = db.collection('sifreTalepleri').orderBy('tarihISO', 'desc').orderBy('saat', 'desc').onSnapshot(s => {
        const talepler = s.docs.map(d => ({ id: d.id, ...d.data() }));
        let html = '';
        if (talepler.length === 0) {
            html = '<div class="muted">Bekleyen talep yok.</div>';
        } else {
            html = talepler.map(t => `
                <div class="flex justify-between items-center text-xs py-1 border-b border-gray-700">
                    <span>${esc(t.kullanici)} - ${t.tarih} ${t.saat}</span>
                    <span class="text-yellow-400">${t.durum}</span>
                </div>
            `).join('');
        }
        document.getElementById('sifre-talepleri').innerHTML = html;
    });
    window.aktifListeners.push(un);
}
}
