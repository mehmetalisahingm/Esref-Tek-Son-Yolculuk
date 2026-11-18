# Katkıda bulunma

## Utku ve ekip: Claude kurmadan kod gönderme (Windows)

**Claude / Claude Code bu repoda zorunlu değil.** Kod değiştirmek ve GitHub'a göndermek için Git for Windows ve Node.js 20+ yeterlidir. GitHub Actions yalnızca `npm test` çalıştırır; Claude komutu, Claude API anahtarı veya Claude Code gerekmez.

### 1) Gerekli araçları kontrol et

PowerShell'de:

```powershell
git --version
node --version
npm --version
```

`git` bulunamazsa https://git-scm.com/download/win, `node` bulunamazsa https://nodejs.org/ adresinden kur. Kurulumdan sonra terminali yeniden aç.

### 2) Repoyu indir ve değişiklik yap

```powershell
git clone https://github.com/mehmetalisahingm/Esref-Tek-Son-Yolculuk.git
cd Esref-Tek-Son-Yolculuk
git switch -c feat/utku-ilk-gelistirme
npm test
```

İlk adımda repo zaten bilgisayarda varsa `git clone` yerine o klasöre gir; dal adını çalışacağın işe göre değiştir.

### 3) Değişiklikleri gönder

```powershell
git status
git add .
git commit -m "feat: Utku oyun iyilestirmeleri"
git push -u origin feat/utku-ilk-gelistirme
```

Ardından GitHub'da açılan bağlantıdan **Pull Request** oluştur. `main` dalına doğrudan push yerine kendi dalını kullan.

### Hata alırsan

- `'git' is not recognized`: Git for Windows kurulu değil / PATH'te bulunmuyor.
- `'node' is not recognized`: Node.js kurulu değil / PATH'te bulunmuyor.
- `'claude' is not recognized` veya `claude: command not found`: Bu proje Claude gerektirmez. Hata yerel editör eklentisi, terminal komutu veya yerel Git hook'undan kaynaklanıyor olabilir. Önce yukarıdaki **doğrudan git komutlarıyla** dene; hata sürerse tam çıktıyı issue'ya koy.
- `Permission denied`, `403` veya `Authentication failed`: GitHub oturumu ve doğru hesabı kontrol et. Utku'nun bu repoda `write` yetkisi var; yine de bilgisayarda yanlış hesapla oturum açılmış olabilir. GitHub hesabının parolasını/kodunu/erişim tokenını issue'ya koyma.
- `non-fast-forward`: Yanlışlıkla `main`'e gönderme; kendi dalınla çalış, gerekirse `git fetch origin` ve `git rebase origin/main` yap.
- `nothing to commit`: Git bir değişiklik görmüyor; `git status` ile kontrol et.

Hâlâ olmuyorsa `git status`, `git remote -v`, `git branch --show-current` ve `git push` hata mesajını (kişisel bilgileri/gizli anahtarları gizleyerek) GitHub issue'suna ekle.

## Test ve çalışma

- `npm test` — oyun mantığının 9 otomatik testi.
- `node server.mjs` — yerel oyun: http://localhost:3000
- `http://localhost:3000/?overlay=1` — OBS/TikTok yayın görünümü.
- Gerçek TikTok verileri için `tiktok-live-connector` isteğe bağlı kurulur; normal Git push için gerekli değildir.

## Ekip
- Mehmet (`@mehmetalisahingm`) — repo sahibi ve entegrasyon
- Utku (`@Utkuuzun14`) — ortak geliştirici, `write` erişimi doğrulandı

Üçüncü taraf dizi fotoğraflarını veya telifli müzikleri repoya yüklemeyin. Gerçek TikTok entegrasyonunu test ederken kullanıcı hesabı gizli bilgilerini depolamayın.
