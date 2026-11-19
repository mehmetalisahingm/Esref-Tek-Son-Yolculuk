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

## Gerçek TikTok LIVE verilerini bağla

Yayın açmadan önce terminalde bu klasörün içinde:

```bash
npm install
node server.mjs
```

Sonra normal kontrol panelinde TikTok kullanıcı adını **@ olmadan** gir ve **Yayına Bağlan** düğmesine bas.

- **Normal hediye:** gönderen kişi altı taşıyıcıdan birine alınır.
- **Özel fotoğraf taşıma:** TikTok'un bildirdiği `gift.diamondCount` değeri × adet, kullanıcının bu yayındaki *hediye puanına* eklenir. Varsayılan eşiği **500** puan; kontrol panelinden 10–100.000 arasında değiştirebilirsin. Eşiği aşan ve en yüksek toplam puana sahip izleyici, 6 kişinin dışında tek başına Eşref Tek fotoğrafını taşır. Başkası daha fazla puan toplarsa yerini alır. Bu hesap gerçek para, kullanıcının TikTok cüzdanı ya da kesin coin fiyatı iddiası değildir. Bağlayıcı puan değerini iletmezse özel rol için 0 puan sayılır (normal hediye taşıyıcıya yansır).
- **Fotoğraf değişimi:** Kontrol panelindeki fotoğraf yükleme alanı JPEG / PNG / WebP, en fazla 2 MB. Bu görsel yerel sunucuda `public/portrait-custom.*` olarak saklanır ve OBS ekranında da görünür. Varsayılan resmin yüklenmesi için internet gerekir.
- **Yorum:** gönderen kişi arkadaki korteje eklenir, yorumu sahnede balon olarak görünür.
- **Beğeni:** kişi korteje eklenir ve elinde mum yanar.
- **Takip / paylaşım:** sahnede duyurulur, kişi korteje eklenir.
- **İzleyici sayısı:** TikTok'un bildirdiği anlık izleyici sayısı sağ üstte görünür.
- **Üye/giriş/takip bildirimi:** kullanıcı görünüyorsa korteje eklenir; tüm sessiz izleyiciler TikTok tarafından ayrı ayrı bildirilmez.
- **Hediye serisi:** tekrar sayısı kümülatif olduğunda farkı alınır.

Bu bağlantı **resmî TikTok API'si değildir**. TikTok protokolü/bağlantı sağlayıcısı değişikliklerinde çalışma garantisi yoktur; canlı yayınla uçtan uca test gereklidir. Bazı canlı yayınlara bağlanmak için üçüncü taraf imzalama sağlayıcısında API anahtarı gerekebilir (resmî doküman: https://ttlc.docs.isaackogan.com/). Bu proje TikTok hesabının giriş bilgilerini istemez veya saklamaz. Yayın açık değilse bağlantı kurulamaz.

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

`server.mjs` — oyun durumu, rotasyon, SSE, TikTok entegrasyonu  
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

`npm test` komutu 16 senaryoyu doğrular. GitHub Actions her push ve PR'da testleri çalıştırır.

### İlk GitHub yüklemesi (Windows)

1. [Yeni repo oluştur](https://github.com/new) sayfasında `Esref-Tek-Son-Yolculuk` adında **boş** repo aç (`Add a README` işaretleme).
2. Dosyaları ZIP'ten çıkar ve `GITHUBA_YUKLE.bat` dosyasına çift tıkla (Git for Windows gerektirir).
3. Utku'yu `Settings → Collaborators → Add people → Utkuuzun14` yolundan davet et.
