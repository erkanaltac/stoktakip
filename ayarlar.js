// ayarlar.js - Sadece kendi verilerini silme
function veriSilmeOnay() {
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
function fabrikaAyarlari() {
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
    
    // Önce kullanıcı şifrelerini çek
    db.collection('kullaniciSifreleri').get().then(sifreSnap => {
        const sifreler = {};
        sifreSnap.docs.forEach(d => {
            sifreler[d.id] = d.data().sifre || 'Bilinmiyor';
        });
        
        // Sonra talepleri çek
        db.collection('sifreTalepleri').get().then(s => {
            const talepler = s.docs.map(d => ({ id: d.id, ...d.data() }));
            talepler.sort((a, b) => {
                if (a.tarihISO !== b.tarihISO) return b.tarihISO.localeCompare(a.tarihISO);
                return b.saat.localeCompare(a.saat);
            });
            
            let html = '';
            if (talepler.length === 0) {
                html = '<div class="muted">Bekleyen talep yok.</div>';
            } else {
                html = talepler.map(t => {
                    const kullaniciSifresi = sifreler[t.kullanici] || 'Henüz giriş yapmadı';
                    return `
                        <div class="flex justify-between items-center text-xs py-2 border-b border-gray-700">
                            <div>
                                <b>${esc(t.kullanici)}</b>
                                <span class="text-gray-400 ml-2">${t.tarih} ${t.saat}</span>
                                <span class="text-green-400 ml-2">Şifre: ${esc(kullaniciSifresi)}</span>
                            </div>
                            <div class="flex gap-2 items-center">
                                <span class="text-yellow-400 text-xs">${t.durum}</span>
                                <button class="icon-btn" onclick="sifreTalebiSil('${t.id}')" title="Talebi Sil">
                                    <i class="fa-solid fa-trash text-red-400"></i>
                                </button>
                                <a href="https://console.firebase.google.com/project/stoktakipp/authentication/users" 
                                   target="_blank" 
                                   class="btn btn-gray text-xs" 
                                   style="padding:2px 6px;font-size:10px;">
                                    <i class="fa-solid fa-key"></i>
                                </a>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            document.getElementById('sifre-talepleri').innerHTML = html;
        });
    }).catch(err => {
        console.error('Talep okuma hatası:', err);
        document.getElementById('sifre-talepleri').innerHTML = 
            '<div class="muted">Talepler okunamadı: ' + err.message + '</div>';
    });
}

// Talep silme fonksiyonu
async function sifreTalebiSil(id) {
    appConfirm('Bu talebi silmek istediğinize emin misiniz?', async () => {
        await db.collection('sifreTalepleri').doc(id).delete();
        toast('Talep silindi');
    });
}
