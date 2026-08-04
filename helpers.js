// helpers.js – Klavye sorunu çözüldü + Tüm yardımcı fonksiyonlar
// Toast bildirimi
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2200);
}

// HTML escape
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Türkçe küçük harf
function trLower(s) {
  return String(s || '').toLocaleLowerCase('tr');
}

// İlk harfleri büyük, diğerleri küçük yap
function formatText(str) {
  return String(str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr')
    .replace(/(^|\s)\S/g, c => c.toLocaleUpperCase('tr'));
}

// İki haneli sayı
function pad2(n) {
  return String(n).length < 2 ? '0' + n : String(n);
}

// Bugünün ISO tarihi
function isoBugun() {
  return new Date().toISOString().slice(0, 10);
}

// Şimdiki tarih ve saat objesi
function nowTarih() {
  const d = new Date();
  return {
    iso: isoBugun(),
    display: pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear(),
    saat: pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  };
}

// ISO tarihi görüntü formatına çevir
function isoToDisplay(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
}

// Diziden benzersiz elemanları döndür
function uniq(arr) {
  const seen = {};
  const out = [];
  arr.forEach(x => {
    if (x && !seen[x]) {
      seen[x] = true;
      out.push(x);
    }
  });
  return out;
}

// Aktif kullanıcı adı
function kullaniciAdi() {
  return window.aktifKullanici ? window.aktifKullanici.email.split('@')[0] : 'bilinmiyor';
}

// Stok durum badge'i
function durumBadge(d) {
  const c = d === 'STOK YOK' ? 'b-yok' : d === 'AZ STOK' ? 'b-az' : 'b-ok';
  return '<span class="badge ' + c + '">' + d + '</span>';
}

// Modal işlemleri
function openModal(title, html) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// Mini modal (alert)
function appAlert(msg, title) {
  document.getElementById('miniTitle').textContent = title || 'Bilgi';
  document.getElementById('miniBody').innerHTML =
    '<div class="text-sm mb-3">' + msg + '</div><div class="flex justify-end"><button class="btn btn-blue" onclick="closeMini()">Tamam</button></div>';
  document.getElementById('miniOverlay').style.display = 'flex';
}

function closeMini() {
  document.getElementById('miniOverlay').style.display = 'none';
}

// Mini modal (onay)
function appConfirm(msg, onYes, title) {
  document.getElementById('miniTitle').textContent = title || 'Onay';
  document.getElementById('miniBody').innerHTML =
    '<div class="text-sm mb-3">' + msg +
    '</div><div class="flex justify-end gap-2"><button class="btn btn-gray" onclick="closeMini()">Vazgeç</button><button class="btn btn-red" id="miniYesBtn">Evet</button></div>';
  document.getElementById('miniOverlay').style.display = 'flex';
  document.getElementById('miniYesBtn').onclick = function () {
    closeMini();
    onYes();
  };
}

// Overlay tıklama ile kapatma
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.getElementById('miniOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'miniOverlay') closeMini();
  });
});

// Arama inputlarını temizle
function clearSearchInputs() {
  document.querySelectorAll(
    'input[type=text], input[type=search], input:not([type=checkbox]):not([type=date]):not([type=file]):not([type=password])'
  ).forEach(i => {
    if (i.id !== 'login-kullanici' && i.id !== 'login-sifre' && i.id !== 'yeni-sifre' && i.id !== 'veri-sil-sifre') {
      i.value = '';
    }
  });
}

// ======================= SUGGEST SİSTEMİ (DÜZELTİLMİŞ) =======================
// currentSuggest artık hangi input elemanına ait olduğunu (inputEl) da tutuyor.
// Bu sayede: (1) Tab ile başka alana geçildiğinde eski liste kapanıyor,
// (2) klavye olayı sadece o anda odaklanılmış olan alanın listesine uygulanıyor.
let currentSuggest = null; // { listEl, items, onPick, inputEl, activeIndex }

function renderSuggest(listEl, items, onPick, inputEl) {
  if (!items.length) {
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    if (currentSuggest && currentSuggest.listEl === listEl) {
      currentSuggest = null;
    }
    return;
  }

  listEl.innerHTML = items
    .map((it, i) => '<div class="it" data-i="' + i + '">' + esc(it) + '</div>')
    .join('');
  listEl.style.display = 'block';

  // Güncel listeyi global değişkene kaydet
  currentSuggest = {
    listEl: listEl,
    items: items,
    onPick: onPick,
    inputEl: inputEl || null,
    activeIndex: -1
  };

  const itDivs = listEl.querySelectorAll('.it');
  itDivs.forEach(function (el) {
    el.onclick = function (e) {
      e.stopPropagation();
      onPick(items[Number(el.dataset.i)]);
      listEl.style.display = 'none';
      currentSuggest = null;
    };
  });

  // Input, odağını kaybettiğinde (Tab ile geçiş, tıklama vb.) listeyi kapat.
  // Küçük bir gecikme veriyoruz ki bir öneriye TIKLAMA olayı önce işlensin.
  if (inputEl && !inputEl.dataset.suggestBlurBound) {
    inputEl.dataset.suggestBlurBound = '1';
    inputEl.addEventListener('blur', function () {
      setTimeout(function () {
        if (currentSuggest && currentSuggest.inputEl === inputEl) {
          listEl.style.display = 'none';
          currentSuggest = null;
        }
      }, 150);
    });
  }
}

// Tek bir global keydown dinleyicisi – input'a ASLA karışmaz
document.addEventListener('keydown', function (e) {
  if (!currentSuggest) return;
  const { listEl, items, onPick, inputEl } = currentSuggest;
  if (!listEl || listEl.style.display !== 'block') return;

  // KRİTİK DÜZELTME: Bu liste, o anda klavye odağında olan alana ait değilse
  // (örn. Tab ile başka bir kutuya geçilmiş ama eski liste kapanmamışsa),
  // bu tuşa hiç dokunma. Eski hatada başka bir kutudaki Ok/Enter tuşu
  // yanlışlıkla ilgisiz bir öneri listesini kontrol ediyordu.
  if (inputEl && document.activeElement !== inputEl) return;

  const activeItems = listEl.querySelectorAll('.it');
  if (activeItems.length === 0) return;

  // Mevcut aktif öğeyi bul
  let activeIdx = -1;
  activeItems.forEach((el, i) => {
    if (el.classList.contains('active')) activeIdx = i;
  });

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    activeIdx = activeIdx < activeItems.length - 1 ? activeIdx + 1 : 0;
    activeItems.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
    currentSuggest.activeIndex = activeIdx;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    activeIdx = activeIdx > 0 ? activeIdx - 1 : activeItems.length - 1;
    activeItems.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
    currentSuggest.activeIndex = activeIdx;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (activeIdx >= 0 && activeIdx < activeItems.length) {
      activeItems[activeIdx].click();
    } else {
      listEl.style.display = 'none';
      currentSuggest = null;
    }
  }
  // Diğer tüm tuşlar (harf, rakam, boşluk) olduğu gibi çalışır – yazma engellenmez
});

// Dışarı tıklayınca tüm listeleri kapat
document.addEventListener('click', function (e) {
  if (!e.target.closest('.suggest-wrap')) {
    document.querySelectorAll('.suggest-list').forEach(l => l.style.display = 'none');
    currentSuggest = null;
  }
});
function kol(ad) { return db.collection(ad); }
function trKarsilastir(a, b) { return String(a || '').localeCompare(String(b || ''), 'tr'); }

// Firestore koleksiyon kısayolu
function kol(ad) {
    return db.collection(ad);
}

// Türkçe karakter uyumlu sıralama
function trKarsilastir(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'tr');
}
