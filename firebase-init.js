const firebaseConfig = window.__FIREBASE_CONFIG__;
if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error('Firebase yapılandırması bulunamadı. config.js eksik olabilir.');
}

firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
function kol(ad) {
    if (!window.aktifKullanici) {
        console.error('kol(): Kullanıcı girişi yapılmadan koleksiyona erişilmeye çalışıldı: ' + ad);
        throw new Error('Kullanıcı girişi yapılmamış');
    }
    return db.collection('kullanicilar').doc(window.aktifKullanici.uid).collection(ad);
}
window.kol = kol;
