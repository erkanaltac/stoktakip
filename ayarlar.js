// ayarlar.js
// Ayarlar Modülü – şifre değiştirme, tercihler, veri silme, fabrika ayarları

// Not: sifreGuncelle() zaten auth.js içinde tanımlandı.
// Burada yalnızca ayarlar modülüne özel ek fonksiyonlar yer alır.
// (Tercih kaydetme ve modül yetki fonksiyonları main.js içindedir.)

function veriSilmeOnay() {
    const sifre = document.getElementById('veri-sil-sifre').value;
    if (!sifre) {
        toast('Lütfen şifrenizi girin.');
        return;
    }
    // Yeniden kimlik doğrula
    auth.signInWithEmailAndPassword(window.aktifKullanici.email, sifre)
        .then(() => {
            const secili = [];
            document.querySelectorAll('.veri-sil-check:checked').forEach(cb => secili.push(cb.value));
            if (secili.length === 0) {
                toast('Hiçbir veri türü seçilmedi.');
                return;
            }
            appConfirm(
                'Seçili verileri (' + secili.join(', ') + ') silmek istediğinize emin misiniz? Bu işlem geri alınamaz!',
                async () => {
                    try {
                        for (const col of secili) {
                            const snap = await db.collection(col).get();
                            const batch = db.batch();
                            snap.docs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                        }
                        toast('Seçili veriler silindi.');
                    } catch (e) {
                        appAlert('Silme hatası: ' + e.message);
                    }
                },
                'Veri Sil'
            );
        })
        .catch(() => toast('Şifre yanlış!'));
}

function fabrikaAyarlari() {
    const sifre = document.getElementById('veri-sil-sifre').value;
    if (!sifre) {
        toast('Lütfen şifrenizi girin.');
        return;
    }
    auth.signInWithEmailAndPassword(window.aktifKullanici.email, sifre)
        .then(() => {
            appConfirm(
                'TÜM VERİLER SİLİNECEK! Bu işlem geri alınamaz. Devam edilsin mi?',
                async () => {
                    try {
                        const collections = [
                            'kullanim_alt', 'kullanim_ust',
                            'depo_kayitlari', 'ariza_kayitlari', 'kameralar',
                            'adresler_alt', 'adresler_ust',
                            'malzemeler_alt', 'malzemeler_ust',
                            'depo_malzemeler', 'stok_hareketleri'
                        ];
                        for (const col of collections) {
                            const snap = await db.collection(col).get();
                            const batch = db.batch();
                            snap.docs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                        }
                        toast('Fabrika ayarlarına dönüldü.');
                    } catch (e) {
                        appAlert('Fabrika ayarlarına dönme hatası: ' + e.message);
                    }
                },
                'Fabrika Ayarları'
            );
        })
        .catch(() => toast('Şifre yanlış!'));
}
