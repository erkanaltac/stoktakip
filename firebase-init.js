const firebaseConfig = window.__FIREBASE_CONFIG__;
if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error('Firebase yapılandırması bulunamadı. config.js eksik olabilir.');
}

firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
