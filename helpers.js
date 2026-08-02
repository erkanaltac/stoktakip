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
    document.getElementById('miniBody').innerHTML = '<div class="text-sm mb-3">' + msg + '</div><div class="flex justify-end"><button class="btn btn-blue" onclick="closeMini()">Tamam</button></div>';
    document.getElementById('miniOverlay').style.display = 'flex';
}

function closeMini() {
    document.getElementById('miniOverlay').style.display = 'none';
}

// Mini modal (onay)
function appConfirm(msg, onYes, title) {
    document.getElementById('miniTitle').textContent = title || 'Onay';
    document.getElementById('miniBody').innerHTML = '<div class="text-sm mb-3">' + msg + '</div><div class="flex justify-end gap-2"><button class="btn btn-gray" onclick="closeMini()">Vazgeç</button><button class="btn btn-red" id="miniYesBtn">Evet</button></div>';
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
    document.querySelectorAll('input[type=text], input[type=search], input:not([type=checkbox]):not([type=date]):not([type=file]):not([type=password])').forEach(i => {
        if (i.id !== 'login-kullanici' && i.id !== 'login-sifre' && i.id !== 'yeni-sifre' && i.id !== 'veri-sil-sifre') {
            i.value = '';
        }
    });
}

// Gelişmiş suggest (arama önerileri) – klavye ile gezinme düzeltildi
var suggestActiveIndex = -1;

function renderSuggest(listEl, items, onPick, inputEl) {
    if (!items.length) {
        listEl.style.display = 'none';
        listEl.innerHTML = '';
        suggestActiveIndex = -1;
        return;
    }

    listEl.innerHTML = items.map(function (it, i) {
        return '<div class="it" data-i="' + i + '">' + esc(it) + '</div>';
    }).join('');
    listEl.style.display = 'block';
    suggestActiveIndex = -1;
    var itDivs = listEl.querySelectorAll('.it');

    itDivs.forEach(function (el) {
        el.onclick = function (e) {
            e.stopPropagation();
            onPick(items[Number(el.dataset.i)]);
            listEl.style.display = 'none';
            suggestActiveIndex = -1;
            if (inputEl) inputEl.focus();
        };
    });

    // Input'a sadece bir kez keydown dinleyicisi ekle (daha önce eklenmediyse)
    if (inputEl && !inputEl._suggestKeyBound) {
        inputEl._suggestKeyBound = true;
        inputEl.addEventListener('keydown', function (e) {
            // Şu anda görünen suggest listesini bul
            var activeList = document.querySelector('.suggest-list[style*="block"]');
            if (!activeList) return;

            var items = activeList.querySelectorAll('.it');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                suggestActiveIndex = Math.min(suggestActiveIndex + 1, items.length - 1);
                updateActive(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                suggestActiveIndex = Math.max(suggestActiveIndex - 1, 0);
                updateActive(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (suggestActiveIndex >= 0 && suggestActiveIndex < items.length) {
                    items[suggestActiveIndex].click();
                } else {
                    activeList.style.display = 'none';
                }
            }
            // Diğer tüm tuşlar (harf, rakam, boşluk vs.) normal çalışır
        });
    }
}

// Dışarı tıklayınca suggest listelerini kapat
document.addEventListener('click', function (e) {
    if (!e.target.closest('.suggest-wrap')) {
        document.querySelectorAll('.suggest-list').forEach(function (l) {
            l.style.display = 'none';
        });
    }
});
