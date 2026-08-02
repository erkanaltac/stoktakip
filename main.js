// Global durum
window.aktifKullanici = null;
window.aktifListeners = [];

// Dinleyicileri temizle
function detachListeners() {
    window.aktifListeners.forEach(function (unsub) {
        try { unsub(); } catch (e) { }
    });
    window.aktifListeners = [];
}

// Ana menüye dön
function anaMenuyuGoster() {
    detachListeners();
    var moduller = ['kullanim-modulu', 'ariza-modulu', 'kamera-modulu', 'depo-modulu', 'ayarlar-modulu'];
    window.kgMatQuery = '';
    window.kgAdrQuery = '';
    window.kgHareketBas = '';
    window.kgHareketSon = '';
    moduller.forEach(function (id) {
        document.getElementById(id).classList.add('gizli');
    });
    document.getElementById('dashboard').classList.remove('gizli');
    clearSearchInputs();
}

// Belirli bir modülü göster
function ekranGoster(ekranId) {
    detachListeners();
    document.getElementById('dashboard').classList.add('gizli');
    var moduller = ['kullanim-modulu', 'ariza-modulu', 'kamera-modulu', 'depo-modulu', 'ayarlar-modulu'];
    moduller.forEach(function (id) {
        document.getElementById(id).classList.add('gizli');
    });
    document.getElementById(ekranId).classList.remove('gizli');

    // Modül başlatma fonksiyonlarını çağır
    if (ekranId === 'kullanim-modulu') kgBaslat();
    if (ekranId === 'ariza-modulu') arizaBaslat();
    if (ekranId === 'kamera-modulu') kameraBaslat();
    if (ekranId === 'depo-modulu') depoBaslat();

    clearSearchInputs();
}

// Modül görünürlüğünü kullanıcı tercihlerine göre ayarla
function modulYetkileriniUygula() {
    if (!window.aktifKullanici) return;

    // Kullanıcı tercihlerini Firestore'dan oku
    db.collection('kullanicilar').doc(window.aktifKullanici.uid)
        .collection('ayarlar').doc('tercihler').get()
        .then(function (doc) {
            if (doc.exists) {
                var pref = doc.data();
                document.getElementById('btn-kullanim').style.display = pref.kullanim ? 'block' : 'none';
                document.getElementById('btn-ariza').style.display = pref.ariza ? 'block' : 'none';
                document.getElementById('btn-kamera').style.display = pref.kamera ? 'block' : 'none';
                document.getElementById('btn-depo').style.display = pref.depo ? 'block' : 'none';

                // Ayarlar sayfasındaki checkbox'ları güncelle
                document.getElementById('pref-kullanim').checked = !!pref.kullanim;
                document.getElementById('pref-ariza').checked = !!pref.ariza;
                document.getElementById('pref-kamera').checked = !!pref.kamera;
                document.getElementById('pref-depo').checked = !!pref.depo;
            } else {
                // Varsayılan olarak tüm modüller görünür
                document.getElementById('btn-kullanim').style.display = 'block';
                document.getElementById('btn-ariza').style.display = 'block';
                document.getElementById('btn-kamera').style.display = 'block';
                document.getElementById('btn-depo').style.display = 'block';
                // Checkbox'ları boş bırak
                document.getElementById('pref-kullanim').checked = false;
                document.getElementById('pref-ariza').checked = false;
                document.getElementById('pref-kamera').checked = false;
                document.getElementById('pref-depo').checked = false;
            }
        });
}

// Kullanıcı tercihlerini kaydet
function kullaniciTercihleriniKaydet() {
    var prefs = {
        kullanim: document.getElementById('pref-kullanim').checked,
        ariza: document.getElementById('pref-ariza').checked,
        kamera: document.getElementById('pref-kamera').checked,
        depo: document.getElementById('pref-depo').checked
    };
    db.collection('kullanicilar').doc(window.aktifKullanici.uid)
        .collection('ayarlar').doc('tercihler').set(prefs)
        .then(function () {
            toast('Tercihler kaydedildi');
            modulYetkileriniUygula();
        });
}

// Kullanıcı adına 5 kez tıklama sayacı (geliştirici popup)
var gelistiriciClickCount = 0;
document.getElementById('kullanici-bilgisi').addEventListener('click', function () {
    gelistiriciClickCount++;
    if (gelistiriciClickCount === 5) {
        gelistiriciClickCount = 0;
        appAlert('geliştirici erkan altaç için mutlaka destek paketi hazırla', 'Bilgi');
    }
});
