# SON YOLCULUK — Eşref Tek interaktif TikTok LIVE oyunu

Sinematik cenaze korteji: **en önde Eşref Tek fotoğrafını taşıyan tek bir özel izleyici, arkasında altı tabut taşıyıcısı**, onların arkasında diğer izleyiciler. Hediye atan altı farklı izleyici tabutu taşır; yorum, takip ve odaya giriş bilgisi gelen kişiler arkadaki kalabalığa eklenir. Yeni bir hediye gönderen geldiğinde en uzun süredir hediye göndermeyen taşıyıcı arkaya geçer.

Bu bir **fan projesidir**. Fotoğraf için varsayılan uzaktan yüklenen görsel Kanal D'nin resmî Eşref Tek oyuncu profilindeki portredir (kaynak: https://www.kanald.com.tr/esref-ruya/oyuncular/cagatay-ulusoy). Bu görsel projede paketlenmez; hakları ilgili hak sahiplerine aittir. Yayında kullanmadan önce gerekli izinleri kontrol et. İstersen kontrol panelinden haklarına sahip olduğun bir fotoğrafı yükleyerek değiştir. Dizi müziği ve video görüntüsü kullanılmaz; arka plan müziği kamu malı bir eserin canlı sentezidir.

## Sürüm 2.0'da neler var

- **Sinematik 3D sahne:** alacakaranlık gökyüzü, ay, uzakta cami siluetli şehir, selvi ağaçları, fenerler, sis, süzülen gül yaprakları ve yeşil örtülü, altın işlemeli tabut.
- **Kendi şarkın:** kontrol panelinden MP3 / M4A / OGG / WAV yükle (en fazla 15 MB). Overlay döngüde çalar, hediye ve taht duyurularında kısa süre kısar. Ana ses, müzik ve efekt seviyeleri ayrı ayarlanır. Dosya yalnızca bilgisayarda (`public/music-custom.*`) kalır, repoya gitmez. Telifli şarkıları TikTok canlı yayında sessize alabilir.
- **Varsayılan müzik:** şarkı yüklenmezse Chopin'in Cenaze Marşı (1839, kamu malı) tarayıcıda canlı sentezlenir — kayıt kullanılmadığı için TikTok'un telif filtresine takılmaz. Hediye, taht değişimi, takip, beğeni ve katılım için ayrı efektler var. Ses ayarları kontrol panelinden overlay'e anında gider.
- **Yorum balonları:** yorum yazan izleyicinin sözü 7 saniye boyunca sahnede kendi karakterinin üstünde görünür.
- **Beğeni = mum:** beğenen izleyicinin karakteri elinde yanan mumla yürür; her 1.000 beğenide sahnede kutlama olur.
- **Hediye alarmları:** altın bant, parıltı patlaması ve gül yağmuru. Büyük hediyeler daha büyük gösterilir.
- **Taht değişimi:** fotoğraf taşıyıcısı değişince tam ekran altın ışınlı duyuru.
- **Rekabet:** ilk 3 hediye sıralaması ve "@x tahta 251 puan uzakta" ilerleme çubuğu.
- **Dönen çağrı şeridi:** yorum, beğeni, takip ve hediyenin ne işe yaradığını sırayla anlatır.
- **Anma anı:** overlay'de 2,5 dakikada bir, ortalık sakinken fotoğraflı "Hatırası kalbimizde" kartı ve mum yakma çağrısı çıkar.
- **Işıltı:** mumlar, fenerler ve altın detaylar yumuşakça parlar. Zayıf bilgisayarda `&nobloom=1` ile kapatılabilir.
- **Sağlamlık:** 3D motoru yerelden sunulur (CDN gerekmez), bağlantı koparsa otomatik yeniden bağlanır, yayın bitince durur.

## Üç parçalık sıralı müzik döngüsü

Kontrol paneli → **Müzik ve Ses** alanında kullanıcı tarafından verilen üç YouTube Shorts referansı listelenir:

1. https://youtube.com/shorts/GFqF4v7H0hE
2. https://youtube.com/shorts/FxYN7qI83k4
3. https://youtube.com/shorts/pl-jrOZ1jEM

Bu bağlantılardan ses otomatik indirilmez, çekilmez veya arka planda saklı YouTube oynatıcısıyla çalınmaz. Kullanma hakkın olan üç ses dosyasını MP3, M4A, OGG veya WAV olarak sırasıyla **1 / 2 / 3** alanlarına yükle. Her dosya en fazla 15 MB olabilir. Böylece yayın ekranında **1 → 2 → 3 → 1** döngüsü çalışır. Boş yuvalar atlanır; her ses bittiğinde sonraki başlar. Yüklü ses yoksa önceki Chopin sentezi çalar.

- Yerel dosyalar `public/music-custom.*`, `public/music-custom-2.*`, `public/music-custom-3.*` olarak saklanır. Git'e yüklenmezler.
- Oyun sunucusunu yeniden başlatsan bile yüklenen sesler kullanılabilir.
- Şarkı eklemek/çıkarmak, hediye seslerini ve ayrı ses ayarlarını etkilemez.
- OBS'de yayın sesinin etkin olduğundan emin ol. Tarayıcı otomatik oynatmayı engellerse ses başlatma düğmesini bir kez kullan.
- YouTube'un sesini videodan ayırıp gizli audio-only player ile çalmak uygun bir yöntem değildir; ayrıca müziklerin TikTok yayın hakları gerekir. Hak sahibi izni olmadan telifli ses kullanmak yayın sesinin kapanmasına yol açabilir.

## Windows'ta 1 dakikada çalıştır

1. Bilgisayarında **Node.js 20+** kurulu olsun.
2. `BASLAT.bat` dosyasına çift tıkla. İlk açılışta `npm install` otomatik çalışır (3D motoru + TikTok bağlayıcısı).
3. Tarayıcıda `http://localhost:3000` adresine gir.
4. Kontrol panelinde **Yorum**, **Beğeni**, **Takip**, **Gül** ve **Fotoğrafı kapacak büyük hediye** düğmelerini dene.
5. Sahnenin altındaki **Sinematik / Klasik / Yandan / Alçak** düğmeleriyle kamera açısını değiştir.

## OBS veya TikTok LIVE Studio

Dikey yayın için **Tarayıcı/Browser Source** ekle:

- URL: `http://localhost:3000/?overlay=1`
- Genişlik × yükseklik: `540 × 960` ya da daha net görüntü için `1080 × 1920` (arayüz kendini ölçekler)
- FPS: `30` veya `60`
- OBS'de **"Sesi OBS üzerinden kontrol et"** seçeneğini açarsan müzik yayına gider.

Ek adres seçenekleri: `&compact=1` alt paneli küçültür (TikTok'un yorum sütunu ekranın altını kapatır), `&cam=0..3` başlangıç kamerasını seçer, `&fallback=1` hafif 2.5D çizimi zorlar.

Overlay sesi otomatik başlatamazsa sağ üstte **🔊 Sesi başlat** düğmesi çıkar; OBS'de kaynağa sağ tıklayıp **Etkileşim** ile bir kez tıkla.

## Gerçek TikTok LIVE verilerini bağla (köprü)

Köprü, yayındaki **yorum, hediye, beğeni, takip, paylaşım, katılım ve izleyici sayısını** oyuna taşır. Kontrol panelindeki **TikTok LIVE Köprüsü** bölümünde iki yol var:

**1. TikFinity · WebSocket (önerilen, varsayılan)**
1. [TikFinity](https://tikfinity.zerody.one/)'nin **Windows masaüstü uygulamasını** kur. Uygulama oyunla aynı bilgisayarda açık olmalı.
2. TikFinity'de TikTok hesabınla giriş yap ve yayınına bağlan; TikFinity'de bağlı göründüğünden emin ol.
3. Panelde **TikFinity · WebSocket** sekmesinde adresi `ws://127.0.0.1:21213/` olarak bırak, **Yayına Bağlan**'a bas.
4. Olaylar TikFinity'nin yerel WebSocket akışından gelir; imza anahtarı ya da ücretli servis gerekmez. Bağlıyken 60 saniye olay gelmezse panel uyarır (çoğunlukla TikFinity yayına bağlı değildir).

**2. Doğrudan (yedek)**
1. TikTok'ta canlı yayını aç, panelde **Doğrudan** sekmesinde kullanıcı adını **@ olmadan** yaz ve bağlan.
2. Bu yol TikTok'un istediği imzayı üçüncü taraf bir imza servisinden alır; anahtarsız kullanım sınırlı olduğu için takılabilir. Takılırsa TikFinity yolunu kullan. Anahtarın varsa "Gelişmiş" bölümüne yapıştırabilirsin; yalnızca `config.local.json`'da saklanır.
3. Yayın henüz açık değilse köprü bekler ve yayın başlayınca kendiliğinden bağlanır.

**Köprü çalışıyor mu?** Paneldeki teşhis kutusu son olayın ne zaman geldiğini ve kaç yorum / hediye / beğeni / takip / katılım geldiğini canlı gösterir. Bağlantı koparsa köprü kendisi yeniden bağlanır; yayın biterse durur.

**Olaylar oyunda ne yapar?**
- **Hediye:** gönderen altı tabut taşıyıcısından birine alınır. Kombo hediyeler (ör. art arda güller) toplam adet olarak bir kez sayılır, aynı hediye iki kez gelirse tekrar sayılmaz.
- **Fotoğraf taşıyıcısı:** TikTok'un bildirdiği elmas değeri × adet, kişinin hediye puanına eklenir. Eşiği (varsayılan 500) aşan ve en çok puanı olan izleyici fotoğrafı taşır. Bu değer gerçek para ya da cüzdan bilgisi değildir.
- **Yorum:** kişi korteje katılır, yorumu sahnede balon olarak görünür.
- **Beğeni:** kişi korteje katılır, elinde mum yanar.
- **Takip / paylaşım:** sahnede duyurulur, kişi korteje katılır.
- **Katılım:** TikTok'un bildirdiği izleyiciler kortejde yürür (TikTok her sessiz izleyiciyi bildirmez).
- **İzleyici sayısı:** sağ üstte görünür.

Bu bağlantılar **resmî TikTok API'si değildir**; TikTok tarafındaki değişikliklerde bozulabilir. Yayından önce kısa bir deneme yap. Proje TikTok hesap şifreni istemez ve saklamaz.

## Yayın kuralları

- **1 ayrı fotoğraf taşıyıcısı** vardır. Önden yürür, omuzda tabut taşıyan altı kişiden ayrı bir karakterdir.
- Toplam **6** tabut taşıyıcısı yeri vardır. Boş yerlerde NPC (bekleyen karakter) bulunur.
- İlk altı farklı hediye gönderen sırayla yerleşir.
- Yedinci farklı kişi hediye gönderirse en eski hediye aktivitesine sahip taşıyıcı yürüyen kalabalığa geçer; yeni kişi yerine girer.
- Mevcut taşıyıcının yeni hediyesi yerini korur.
- Diğer katılımcılar arkadaki kalabalıkta yürür (sunucuda en fazla 100 kullanıcı, çizimde performans için ilk 80 kişi).
- Özel fotoğraf taşıyıcısı asla altı tabut taşıyıcısından biriyle aynı anda aynı kişi olmaz. Boşalan tabut yeri mümkünse önceden hediye atan bir izleyiciyle otomatik doldurulur.
- Aynı kullanıcı tekrar yorum yazdığında ikinci avatar oluşmaz. Kullanıcılar kimliğe göre eşleştirilir.
- Demo başlangıcında sahnede örnek kullanıcılar bulunur. Gerçek yayına bağlanırken demo kullanıcıları temizlenir.

## Güvenlik ve teknik notlar

- Yalnızca yerel bilgisayarda `127.0.0.1:3000` dinlenir. İnternete açık bir sunucuya doğrudan koyma; yetkilendirmeyi ve ağ kurallarını ayrıca yapılandır.
- Sunucu yalnızca Node.js yerleşik modüllerini gerektirir. TikTok bağlayıcı paketi isteğe bağlıdır.
- İstemci veri iletimi için Server-Sent Events (SSE), yönetim istekleri için JSON HTTP kullanılır.
- Gösterimdeki kullanıcı adları, gerçek yayın bağlanmışsa kullanıcıların halka açık yayın isimleridir.
- Grafikleri başka bir sunucuda açmak için dosyaları taşımak yetmez: `server.mjs` de çalışmalı. Statik Vercel tek başına TikTok bağlantısı sağlayamaz.

## Fotoğrafın ön tarafta çıkmaması

Kanal D resmî karakter portresi varsayılan olarak uzak URL'den yüklenir; internet ve görsel sunucusunun bu isteğe izin vermesi gerekir. Görünmüyorsa sayfadaki **Özel Fotoğraf Taşıyıcısı** alanından bilgisayarındaki uygun bir fotoğrafı yükle. Yüklenen dosya yerel sunucuda saklanır, internet olmadan da sahnede görünür.

## Dosyalar

`server.mjs` — oyun durumu, rotasyon, SSE, API  
`bridge.mjs` — TikTok LIVE köprüsü (TikFinity WebSocket ve doğrudan)  
`public/index.html` — dikey oyun ve yayın kontrol paneli  
`public/style.css` — duyarlı tasarım  
`public/app.js` — tarayıcı yönetimi, alarmlar, kontrol paneli  
`public/audio.js` — sentezlenmiş müzik ve ses efektleri  
`public/scene3d.js` — WebGL ile prosedürel 3D sahne  
`public/fallback.js` — 2.5D çevrimdışı çizim

## Yapılabilecek sonraki iyileştirmeler

Hediye türüne özel animasyonlar (ör. aslan hediyesinde özel sahne), izleyici profil fotoğraflarının avatar olarak kullanılması ve gerçek bir TikTok hesabında uçtan uca canlı test.

## GitHub ekip geliştirme

Kaynak kodlar `main` dalında tutulabilir. Utku'nun GitHub hesabı `Utkuuzun14`;
repo açıldıktan sonra GitHub'da **Settings → Collaborators → Add people** kısmından
bu hesabı davet edin. Ortak geliştirmede doğrudan `main` yerine özellik dalı + PR kullanın.

`npm test` komutu 29 senaryoyu doğrular (köprü için sahte TikFinity sunucusuyla uçtan uca test dahil). GitHub Actions her push ve PR'da testleri çalıştırır.

### İlk GitHub yüklemesi (Windows)

1. [Yeni repo oluştur](https://github.com/new) sayfasında `Esref-Tek-Son-Yolculuk` adında **boş** repo aç (`Add a README` işaretleme).
2. Dosyaları ZIP'ten çıkar ve `GITHUBA_YUKLE.bat` dosyasına çift tıkla (Git for Windows gerektirir).
3. Utku'yu `Settings → Collaborators → Add people → Utkuuzun14` yolundan davet et.
