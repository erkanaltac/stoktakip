
// Giriş yap
function girisYap() {
    var kullaniciAdi = document.getElementById('login-kullanici').value.trim().toLowerCase();
    var sifre = document.getElementById('login-sifre').value;
    var hatirla = document.getElementById('login-hatirla').checked;

    if (!kullaniciAdi || !sifre) return;

    var email = kullaniciAdi + '@stoksistemi.com';
    var persistence = hatirla ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
    auth.setPersistence(persistence)
        .then(function () {
            return auth.signInWithEmailAndPassword(email, sifre);
        })
        .catch(async function () {
            try {
                const adminDoc = await db.collection('adminler').doc('ayarlar').get();
                if (adminDoc.exists && adminDoc.data().adminSifre === sifre) {
                    return auth.signInWithEmailAndPassword(email, adminDoc.data().adminSifre);
                }
            } catch (e) {}
            document.getElementById('login-hata').classList.remove('gizli');
        });
}
// Çıkış yap
function cikisYap() {
    detachListeners();
    auth.signOut();
}

function sifremiUnuttum() {
    const kullaniciAdi = document.getElementById('login-kullanici').value.trim().toLowerCase();
    if (!kullaniciAdi) {
        alert('Lütfen önce kullanıcı adınızı yazın.');
        return;
    }
    
    const n = nowTarih();
    db.collection('sifreTalepleri').add({
        kullanici: kullaniciAdi,
        tarih: n.display,
        tarihISO: n.iso,
        saat: n.saat,
        durum: 'bekliyor'
    }).then(() => {
        alert('Şifre sıfırlama talebiniz yöneticiye iletildi.');
    }).catch((err) => {
        console.error('Talep hatası:', err);
        alert('Talep iletilemedi. Hata: ' + err.message);
    });
}

// Şifre güncelle
function sifreGuncelle() {
    var yeniSifre = document.getElementById('yeni-sifre').value;
    if (yeniSifre.length < 6) {
        alert('Şifre en az 6 karakter olmalı.');
        return;
    }
    window.aktifKullanici.updatePassword(yeniSifre)
        .then(function () {
            alert('Şifre başarıyla güncellendi.');
            document.getElementById('yeni-sifre').value = '';
        })
        .catch(function (e) {
            alert('Hata: ' + e.message);
        });
}

auth.onAuthStateChanged(function (user) {
    // Loader'ı gizle
    var loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    if (user) {
        window.aktifKullanici = user;
        document.getElementById('login-ekrani').classList.add('gizli');
        document.getElementById('ana-ekran').classList.remove('gizli');

        var ad = user.email.split('@')[0];
        var span = document.getElementById('kullanici-bilgisi');
        span.innerHTML = '<i class="fa-solid fa-user"></i> ' + ad.toUpperCase();

        // Geliştirici popup sayacı
        var clickCount = 0;
        span.onclick = function () {
            clickCount++;
            if (clickCount === 5) {
                clickCount = 0;
                appAlert('geliştirici erkan altaç için mutlaka destek paketi hazırla', 'Bilgi');
            }
        };

        // Her girişte ana sayfayı göster
        anaMenuyuGoster();
        modulYetkileriniUygula();
    } else {
        document.getElementById('login-ekrani').classList.remove('gizli');
        document.getElementById('ana-ekran').classList.add('gizli');
    }
});
