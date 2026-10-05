# Otium mimarisi — şema 2

## Uygulama ve görünüm

App, gezinme durumunu ve kalıcı verinin tek React kaynağını tutar. Her yeni sekme Home ile başlar. Sidebar 52px genişliğinde sabit bir ikon menüsüdür; Home, Projects ve Settings yerel React state ile seçilir. Router eklenmedi. Projects artık proje listesini ve iki adımlı oluşturma akışını sunar.

HomeView önceki noktalı canvası, kontrolleri, faviconları ve sürükleme davranışını korur. Sekmeler arasında geçişte yalnızca görünümün geçici durumu sıfırlanır; kayıtlar ve ayarlar App seviyesinde kalır.

## Ayarlar ve tema

UserSettings.appearance:
- itemSize: varsayılan 96; 64–160 aralığında 32px adımlı (64/96/128/160).
- theme: system, light veya dark.

Varsayılanlar domain/settings.ts içinde tanımlıdır. useOtiumData canlı ayarları ve kalıcı snapshotı yönetir. Slider anında uygulama state'ini ve gerçek LinkItemContent stillerini kullanan yerel Otium önizlemesini günceller. Yazım 300ms debounce ile veya pointer/klavye/blur/görünüm geçişi sonunda gerçekleşir. Yazımlar sekme içinde sıraya alınır. Başarısız kayıt son başarılı snapshota geri döner ve hata gösterir.

useTheme yalnızca tercihten etkili temayı hesaplar; ayrı preference state'i veya storage anahtarı yoktur. System seçiliyken matchMedia change olayı takip edilir. Home düğmesi aynı appearance.theme alanına açık light/dark tercihi yazar.

Boyut artışında önce hâlâ geçerli konumlar korunur; taşan veya çakışan öğeler deterministik en yakın boş konuma yerleştirilir. Yer yoksa ayar değişikliği kabul edilmez. Ayarlar ve bu konum değişiklikleri birlikte kaydedilir.

## Koordinatlar ve boyutlar

Sidebar, workspace'in dışında kalır. Persist edilen x/y, workspace padding başlangıcına göre grid koordinatıdır. SIDEBAR_WIDTH hiçbir zaman x/y verisine eklenmez.

gridToPixels: padding + grid koordinatı * GRID_SIZE.
pixelsToGrid: padding çıkarılır, GRID_SIZE'a bölünür ve yuvarlanır.
getWorkspaceGeometry: sidebar dışındaki kullanılabilir alanı ve güncel itemSize değerini sağlar.

GRID_SIZE 32px olarak kalır. itemSize artık sabit değil, global kullanıcı ayarıdır. CSS --item-size aynı state'ten beslenir. Add, LinkItem, hedef önizlemesi, çakışma ve viewport hesapları bu değeri kullanır.

SpatialItem yalnızca id, grid konumu ve piksel genişlik/yüksekliği taşır. Dikdörtgen çakışma yardımcıları farklı boyutları kabul eder. getWorkspaceItemDimensions linklerde güncel itemSize, projelerde adın seçtiği 1/2/3 span genişlik ve itemSize yükseklik döndürür; toSpatialItems bu ölçüleri çözer. SpatialDrag farklı footprint kabul eder. LinkWorkspaceItem ve ProjectWorkspaceItem aynı grid üzerinde çalışır.

Geçici pointer/piksel konumu useSpatialDrag içinde, requestAnimationFrame ile güncellenir. Kalıcı modele yalnızca bırakma sonucunda grid konumu gider. Project Slotbar ayrı useSortableDrag kullanır; spatial algoritma ile grid veya koordinat modeli paylaşmaz.

## Domain ve yerleşim

Link: id, title, url, createdAt; isteğe bağlı updatedAt ve projectId.
LinkWorkspaceItem: kendi id'si, type: link, linkId, x, y.
ProjectWorkspaceItem: kendi id'si, type: project, projectId, x, y.
OtiumData: schemaVersion, links, projects, workspaceItems, settings.

Yeni linklerde resource ve placement ayrı UUID alır. Taşımak yalnızca placement x/y alanlarını değiştirir. Aynı kaynak gelecekte farklı yerleşimlerden veya projelerden referanslanabilir.

Project domain tipi ve kayıt/oluşturma arayüzü uygulanmıştır: id, name, sıralı linkIds, createdAt, updatedAt. Link.projectId yoksa link globaldir; varsa ilgili projeye özel olarak modellenebilir. Projeler URL/başlık/favicon kopyalamak yerine Link ID referansları tutar. Projeye özel linkin sahibi Finish sırasında doğrulanır; taslak iptalinde hiçbir link kaydı yazılmaz.

WorkspaceItem link ve project discriminated union'ıdır. Gelecekte WidgetWorkspaceItem ayrı domain ID referansı ve boyut çözümleme kuralıyla eklenebilir. Widget implementasyonu, API anahtarı, cache veya Firebase kodu eklenmedi.

## Yerel storage ve migration

StorageProvider.read/write arayüzünün mevcut sağlayıcısı chrome.storage.local kullanır. Chrome erişimi provider.ts içinde izoledir. React yalnızca dataRepository üzerinden okur/yazar.

Kalıcı anahtar: persistentData.
İçindeki şema sürümü: 2.

İlk yüklemede:
1. persistentData varsa sürümü ve referansları doğrulanır.
2. Yoksa eski links ve theme okunur.
3. Combined link kayıtları domain Links ve linkId referanslı WorkspaceItems olarak ayrılır.
4. Eski ID'ler, URL/başlık bilgileri, createdAt ve grid x/y korunur.
5. Eski light/dark tercihi yeni appearance.theme alanına taşınır.
6. Tek snapshot olarak şema 2 yazılır.

Eski links/theme anahtarları silinmez veya değişmez; kurtarma kopyası olarak kalır. Yeni kod bunları yalnızca migration için okur. Schema 2 bulunduğunda migration yeniden yapılmaz. Eşzamanlı başlangıç okumaları aynı promise'i paylaşır. Hatalı/tekrarlı kayıtlar veya bilinmeyen daha yeni şema sessizce silinmez; migration durur ve kaynak veri korunur.

## İleride sync

Firebase bir senkronizasyon/backup servisi olarak repository/provider sınırına eklenebilir. Yerel okuma/yazım ve offline çalışma buna bağlı olmamalıdır. Cloud belge yolları mevcut kodda sabitlenmedi.

Senkronize edilebilecek veriler: Links, Projects, WorkspaceItems, UserSettings; ileride Widget konfigürasyonları.
Cihazda kalması gerekenler: geçici drag state, açık görünüm/modal, favicon/API cache ve geçici ağ cevapları.

## Bilinen sınırlar ve teknik borç

- Yazım sıralaması bir sekme içindir. Aynı anda açık iki Otium sekmesi aynı snapshotı değiştirirse son yazım kazanır. İleride storage change dinleme ve kayıt bazlı merge/revision gerekir; bu aşamada sync uygulanmadı.
- Kaydedilmiş yerleşimler ekran küçüldüğünde otomatik yeniden yazılmaz. Migration grid konumlarını korur; dar ekran geçici viewport projeksiyonunu kullanır. Yeni eklemeler/drop'lar ve açık itemSize değişiklikleri sınırlar içinde doğrulanır.
- En yakın boş konum araması viewport gridini tarar. Bugünkü boyutlar için basittir; çok sayıda öğede spatial index düşünülebilir.
- pagehide sırasında kayıt en iyi çabayla flush edilir; slider tamamlanınca/görünüm değişince kayıt ayrıca yapılır. Tarayıcı işleminin zorla kapatılması son yazımı garanti etmez.
- Eski migration kopyalarının ne zaman temizleneceğine ileride veri yönetimi kapsamında karar verilmelidir.
- localhost'ta Chrome extension storage bulunmadığından kalıcı işlemler hata gösterir. Bellek/localStorage alternatifi eklenmedi.

## Doğrulama

npm build ve lint; ayrıca node tests/architecture.mjs:
- migration, idempotency, bozuk veride kaynağı koruma;
- varsayılan/kalıcı ayarlar, gecikmeli yazım ve rollback;
- System/light/dark tek tema kaynağı;
- runtime boyut, farklı footprint, çakışma ve sınırlar;
- sidebar dışındaki koordinatlar;
- tıklama eşiği, grab offset, serbest hareket, preview/drop tutarlılığı, pointercancel ve klavye link aktivasyonu.

Hook testleri küçük bir test harness'i kullanır; gerçek Brave arayüzünde görsel ve pointer doğrulamasının yerini bütünüyle tutmaz.


## Projects: ilk işlevsel sürüm

Yeni dosyalar:
- services/projects.ts: getProjects, createProject ve updateProject için domain işlemleri.
- services/projectDraft.ts: bellek taslağı, sıralı seçim, ekleme ve kaldırma yardımcıları.
- views/CreateProjectView.tsx: iki adımlı sayfa akışı.
- components/projects/: ProjectSteps, ProjectIllustration, ProjectSlotbar, ExistingLinks, ProjectLinkForm.
- components/LinkFavicon.tsx: Home, builder, Slotbar ve proje önizlemelerinde ortak favicon/fallback.
- tests/ui.html: yalnızca geliştirme testleri için bellek storage mock'u; üretim index.html bunu yüklemez.

Projeler shared useOtiumData yazım kuyruğu ve dataRepository üzerinden chrome.storage.local'a kaydedilir. React, Chrome storage API'sine doğrudan erişmez. Domain servisi bir snapshot transaction oluşturur; hook bunun persistence/rollback işlemini yürütür.

ProjectDraft, akış başlangıcında sabit bir UUID alır. Name, ordered linkIds ve projectLinks bellekte tutulur. Back adı ve seçimi korur. Slotbar'dan global link kaldırmak underlying Link'i değiştirmez. Taslak özel link kaldırılırsa bellek listesinden de çıkarılır. Cancel veya Finish öncesi sidebar gezinmesi taslağı bırakır; hiçbir kalıcı kayıt yoktur.

Finish; adı, link referanslarını, scope/owner ilişkisini ve tekrarları doğrular. Proje, özel Links ve Home ProjectWorkspaceItem tek persistentData snapshotında birlikte yazılır. Finish sırasında tekrar tıklama engellenir; sabit draft ID servisi retry-safe yapar. Kayıt tamamlanana kadar sidebar/cancel/back geçici olarak devre dışıdır; başarısızlıkta kullanıcı aynı taslağı tekrar deneyebilir.

Sıfır linkli projeler kabul edilir. Project-specific Link için projectId kullanılır; global Link bu alanı taşımaz. Existing Links yalnızca global kaynakları gösterir. Yeni özel link oluşturulunca ordered linkIds sonuna eklenir ve Slotbar'da görünür; Home yerleşimi oluşturulmaz.

SchemaVersion 2 korundu: projects alanı geriye uyumlu bir eklemedir. Eski v2 snapshotında eksikse [] okunur. Sonraki kayıtta yeni alan yazılır. Daha önceki combined kayıt migrationı çalışmaya devam eder; eski links/theme kopyaları korunur. Projects/references/ownership load sırasında doğrulanır.

ProjectSlotbar linkIds, links, onRemove, disabled ve sortable hook'un state/ref/handler alanlarını alır. Array sırası DOM sırasıdır. Veri sahipliği CreateProjectView'dedir; Slotbar storage, URL normalizasyonu veya gezinme işlemi yapmaz.

İki adımlı görünüm; ileri yönde sağdan, geri yönde soldan 240ms CSS giriş animasyonu kullanır. Sidebar animasyona dahil değildir. Reduced-motion animasyonu kapatır. Proje yönetim listesi ilk dört faviconu ve +N taşmasını Link ID'lerinden çözer. Listede Home ProjectCard veya tarayıcı sekmesi açma davranışı yoktur.

Doğrulama:
- node tests/architecture.mjs önceki regresyonları ve proje draft/reference/order/ownership/atomic-write/retry/rollback/reload testlerini çalıştırır.
- tests/ui.html test verisiyle tarayıcıda isim/Enter, adım geçişi, global/özel link seçimi, Back, Cancel, Finish, proje listesi, Home izolasyonu, Settings ve koyu tema kontrol edildi.
- Test fixture storage'ı bellektedir; sayfa reload'u fixture verisini sıfırlar. Gerçek extension persistence yerine geçmez.
- Firebase veya yeni permission eklenmedi.

## Project Builder: sortable sürükleme

Yeni dosyalar: hooks/useSortableDrag.ts, utils/sortable.ts, constants/sortable.ts ve components/projects/SortableDragPreview.tsx. ExistingLinks, ProjectSlotbar ve CreateProjectView hook'u kullanır; App.css görünüm ve hareket stillerini sağlar. Home useSpatialDrag ile algoritma paylaşmaz.

useSortableDrag yalnızca ID, kaynak türü, viewport koordinatı ve insertionIndex tutar. Native Pointer Events, pointer capture ve requestAnimationFrame kullanır. 5px eşik aşılana kadar normal tıklama korunur. Aktif sürükleme sonrası pointer tıklaması bastırılır; klavye ile ekleme/kaldırma erişilebilir kalır. Builder linkleri URL'ye gitmez.

Önizleme 160×42px boyutunda favicon ve başlık içerir. Oransal grab offset korunur; fixed konumlu portal .otium-app içine yerleşerek temayı alır ve sayfa giriş animasyonunun transformundan etkilenmez. Pointer-events none kullanır.

calculateInsertionIndex pointer X'i öğelerin merkezleriyle karşılaştırır. Sürüklenen ID önce geometriden ve hedef diziden çıkarılır; insertOrMoveId kalan dizideki indekse ekler. Böylece sağa/sola taşıma aynı algoritmayla çalışır. Existing Links'ten zaten seçilmiş bir ID sürüklenirse mevcut giriş taşınır; kopya oluşmaz. Boş Slotbar indeks 0 kabul eder.

160×42px fiziksel placeholder hedef boşluğu açar. Kaynak Slotbar öğesi akıştan çıkarılır; gizli DOM düğümü etkileşim boyunca korunur. Placeholder içindeki pointer mevcut indeksi koruyarak geometrinin ileri/geri titreşmesini engeller. Yerleşim hesabı devam eden transform animasyonunu dikkate almaz. Komşular native FLIP/Web Animations ile 180ms kayar; yeni harekette mevcut görsel offset hesaba katılır. Reduced-motion hareketi kapatır.

Slotbar kaynağı gizlenmeden önce pointer capture sabit drop-zone'a aktarılır. Önceki kaynağın lostpointercapture olayı iptal olarak yorumlanmaz; güncel capture sahibinin kaybı sürüklemeyi iptal eder. Pointerup, pointercancel, capture kaybı, Escape, window blur ve unmount; preview, placeholder, rAF ve geçici gesture state'ini temizler. Animasyonlar da unmount sırasında iptal edilir.

Slotbar dışına bırakma draft.linkIds'ten çıkarır. Global Link domain kaydı korunur. Bu taslakta oluşturulan özel link draft.projectLinks'ten de temizlenir; henüz kalıcı veri olmadığı için orphan oluşmaz. Existing Links kaynağını dışarı bırakmak değişiklik yapmaz. Hareket sırasında ne taslak sırası ne storage yazılır; drop yalnızca taslağı değiştirir. Finish son sıralı linkIds ve kalan özel linkleri mevcut atomik snapshot akışıyla kaydeder; Slotbar koordinat saklamaz.

Slotbar tek satırda yatay overflow ve normal yatay kaydırma kullanır. Scroll sırasında aktif insertion hesabı yenilenir; sayfa genişletilmez. Kenar otomatik kaydırması uygulanmadı; gelecekte eklenebilir.

Yeniden kullanım sınırları: hook bugün yatay, soldan sağa tek liste ve tek drop-zone içindir. DOM sözleşmesi data-sortable-list, data-sortable-id ve data-sortable-placeholder alanlarını; kararlı zoneRef ve zoneHandlers bağlantısını gerektirir. Dikey/RTL listeler, birden fazla hedef, değişken preview boyutu ve kenar otomatik kaydırması ayrıca ele alınmalıdır. Kaydedilmiş proje editörü gelecekte aynı ID/callback mekanizmasını kullanabilir; kalıcılık ve sahiplik kontrolü yine çağıranın sorumluluğudur.

Doğrulama: architecture harness merkez hesabını, çift yönlü reorder'ı, duplicate önlemeyi, eşiği, capture aktarımını, iptal/cleanup davranışını, hareket sırasında callback olmamasını ve Finish/repository reload sonrası sırayı sınar. Bellek storage fixture'ı ile gerçek tarayıcı pointer kontrollerinde boş/ara drop, iki yönde taşıma, dışarı çıkarma, özel link temizliği, kaydırılmış listede reorder, küçük hareket/tıklama, Back/Cancel/Finish, açık/koyu tema, Home drag ve Settings kontrol edildi. Fixture testi gerçek Brave extension storage doğrulamasının yerini tutmaz.

## Home: ProjectWorkspaceItem ve proje kartı

Home proje düğmesi utils/projectDimensions.ts üzerinden tek ölçü hesabını kullanır: 14px metin için karakter genişliği tahmini + 24px yatay padding, güncel span genişliklerinden metne uyan en küçük 1/2/3 tier seçer; yükseklik itemSize olur. Eski sabit 208×120px ölçüler kaldırılmıştır. Render, hedef, placement, boyut değişiminde fit ve atomik hareket doğrulaması aynı proje listesini/ölçülerini kullanır.

components/ProjectCard.tsx yalnızca çözümlenmiş Project/Links ve onMove/onOpen callback'lerini alır. İsim, sıralı ilk dört geçerli favicon ve +N gösterir; sıfır geçerli linkte metadata göstermez. Ortak LinkFavicon fallback'i kullanılır, dekoratif favicon satırı aria-hidden'dır. Kart native button olduğu için klavyeyle aktive edilir.

Projeler useSpatialDrag'ın mevcut 5px eşik, grab offset, serbest pointer hareketi, grid hedefi, snap ve click bastırmasını kullanır. Target preview gerçek kart footprint'ini gösterir. SortableDrag'a bağımlılık eklenmedi. Normal pointermove yalnızca kartın geçici React durumunu günceller; drop useOtiumData.moveItem üzerinden x/y kaydeder. Opsiyonel yatay insertion yolu aşağıda açıklanmıştır.


getWorkspaceItemDimensions tek boyut çözümleme noktasıdır. Spatial collision, clamping, initial search, move doğrulaması ve itemSize değişiminde fit aynı dikdörtgenleri kullanır. Link boyutu ayarla değişir; Project ölçüleri güncel itemSize ve adın seçtiği span ile değişir. Konumlar sidebar dışındaki workspace origin'ine göredir. Add ve sağ üst kontrol dikdörtgenleri, padding ve viewport sınırları da doğrulanır.

services/projectPlacement.ts domain oluşturmayı placement üretiminden ayırır. useOtiumData.createProject önce içerik transaction'ını kurar, ardından placeProject ile ayrı UUID'li yerleşim ekler; yalnızca tamamlanmış snapshotı publish/persist eder. İlk konum kartın width/height + ITEM_GAP adımlarıyla üstten sola taranır; gerekirse en yakın boş grid araması yapılır. Yer yoksa yaratma kalıcı veya geçici kısmi kayıt bırakmadan hata verir.

Repository initialization mevcut şema-2 snapshotını parse ettikten sonra reconcileProjectPlacements çalıştırır. projectId için placement yoksa boş konuma ekler; mevcut ID/x/y değişmez. Backfill snapshotı yalnızca ekleme olduysa kaydedilir. Paylaşılan initialization promise'i eşzamanlı yüklemeyi birleştirir; sonraki reload'lar kopya oluşturmaz. Dar/dolu viewport'ta kalan projelerin yerleşimi daha sonraki initialization'a ertelenir; domain verisi kaybolmaz. Backfill yazımı başarısızsa yükleme hata verir ve eski snapshot korunur.

Şema sürümü 2 korundu; workspace type: project eklemesi mevcut link verilerini dönüştürmez. Missing project linkId referansları load sırasında korunur; resolveProjectLinks onları görünüm/aktivasyonda atlar. Hatalı tür, tekrar ve başka projenin özel linkine referans hâlâ reddedilir. Link kayıtlarının URL doğrulaması mevcut korumayı sürdürür. Orphan ProjectWorkspaceItem korunur ve render edilmez; geometri koleksiyonunda yer ayırmaya devam eder. Silme veya veri temizliği yapılmadı.

services/browserTabs.ts Chrome tab API sınırıdır. Project.linkIds sırasındaki çözümlenmiş, HTTP(S) URL'ler ardışık await chrome.tabs.create({ url, active: false }) ile normal arka plan sekmelerinde açılır. Otium sekmesi açık kalır; tab group kullanılmaz. Aynı projenin devam eden açılışına gelen tekrar aynı promise'i paylaşır; rerender açılış başlatmaz. Boş proje API'ye erişmez. API başarısızlığı Home'da hata gösterir; daha önce açılmış sekmeler geri alınmaz. Sıra tamamlandıktan sonra yeni bilinçli aktivasyon yeniden açar.

Chrome resmi Tabs API belgesine göre sekme oluşturma ek izin istemez: https://developer.chrome.com/docs/extensions/reference/api/tabs . Manifest yalnızca storage izni taşır. tabs veya tabGroups eklenmedi.

Yeni doğrulamalar: mixed-size collision yönleri, kart clamping, büyük footprint spatial hook/grab offset, atomic placement ve move persistence/rollback, full viewport başarısızlığı, backfill tekrar/konum koruma/yazım hatası, missing/orphan referanslar ve ordered/concurrent/empty/error tab service testleri. tests/project-home.html yalnızca geliştirme fixture'ıdır: sessionStorage reload kontrolünü sağlar, chrome.storage ve tabs.create mock'ları üretime dahil değildir. Gerçek tarayıcı pointer kontrollerinde yeni/eski proje kartları, Link↔Project ve Project↔Project drop, ekran sınırı, yeniden yükleme, 120px Link ayarı, iki tema, Builder sortable ve Projects yönetimi kontrol edildi. Gerçek Brave extension API/persistence testi ayrıca gereklidir.

Yeni türlerden önce dikkate alınacak sınırlar: boyut çözümleme ile render ölçüleri birlikte güncellenmeli; orphan kayıtlar boş alanı rezerve eder. Viewport küçülmesi mevcut konumları otomatik yazmaz. Backfill alan bulamadığında yeniden initialization gerekir. Snapshot yazım kuyruğu yalnızca tek sekme içindir; çoklu sekme revision/merge henüz yoktur. Tab açılışının kısmi başarısızlığında tekrar aktivasyon önce açılmış sekmeleri çoğaltabilir; mevcut sekmeleri sorgulama veya session yönetimi bu kapsamda eklenmedi.

## Home: opsiyonel yatay insertion

Yeni dosyalar:
- constants/insertion.ts: hedef bölgesi, satır toleransı ve hysteresis sabitleri.
- utils/horizontalInsertion.ts: saf aday, satır, tüm layout önerisi ve doğrulama yardımcıları.
- services/workspacePositions.ts: mevcut snapshot üzerinde toplu konum doğrulama/güncellemesi.
- tests/hybrid-home.html: yalnızca test fixture'ı; sessionStorage reload, storage/tab mock ve gizli DOM önizleme kayıtları.

Değişen dosyalar: App.tsx, App.css, views/HomeView.tsx, components/LinkItem.tsx, components/ProjectCard.tsx, hooks/useSpatialDrag.ts, hooks/useOtiumData.ts, tests/architecture.mjs ve bu belge. Project Slotbar, useSortableDrag, domain şeması, manifest ve bağımlılıklar değişmedi.

Home absolute x/y canvas olmaya devam eder. Insertion bir ayar/list order modeli değil, dar bir hedef bölgesine girince etkinleşen ek sürükleme yoludur. Boş alanda önceki nearest-free spatial hedefi kullanılır. Storage'a homeOrder, rowIndex veya sortIndex eklenmez.

findHorizontalInsertionCandidate sürüklenen ID'yi çıkarır ve kaydedilmiş dikdörtgenleri kullanır. Komşuların üst kenarları en fazla GRID_SIZE/2 (16px) farklı olmalı; dikey kesişim küçük yüksekliğin en az %75'i olmalıdır. Grid koordinatları bugün 32px olduğundan bu kural normalde aynı y satırını seçer. Sağdaki ilk uyumlu komşu ile gerçek kenar boşluğu 0–64px ise aday oluşturulur; uzak ve dağınık öğeler arasında hedef açılmaz.

Intent zone, iki kenar arasındaki orta noktanın çevresindedir. Yatay yarı genişliği boşluğa göre 8–16px'tir. Dikey bölge iki dikdörtgenin ortak aralığıdır; üstten/alttan en fazla 16px daraltılır. Pointer workspace-local koordinatlara dönüştürülür; source grab offset korunur. Adaya giriş dar bölgeyi gerektirir; çıkış için 8px ek pay uygulanır. Hysteresis yalnızca aynı komşu çiftini tutar; geçersiz layout tutulmaz. Animasyonlu DOM konumları aday hesabına katılmaz.

proposeHorizontalInsertion gerçek sağ kenar + GRID_SIZE (32px) sonrasındaki ilk grid konumunu ceil ile kullanır; padding origin hesaba katılır. Desteklenen bütün boyutlar ve proje genişlikleri grid katı olduğundan otomatik boşluk tam 32px olur. Yalnızca etkilenen yerel zincir normalize edilir; uzak manuel boşluklar ve başka satırlar korunur. Kaynağın eski footprint’i zinciri bağlayabilir. Tekrarlı sıralama boşluk biriktirmez. Sola/sağa hareket alanı engellere karşı doğrulanır; wrap/dikey reflow yoktur.

Öneri yalnızca draggedPosition, movedItems ve geçici candidate içerir; model verisini değiştirmez. Boyutların kaynağı SpatialItem.width/height'tır. Link'in güncel itemSize'ı ve Project'in adaptif footprint'i aynı algoritmadan geçer. Değişmeyen başka satır öğeleri taşınmaz. Moved neighbor'ın eski-yeni dikdörtgeni arasındaki süpürülen alan da kontrol edilir; ilgisiz veya taşınmayan nesnenin üzerinden atlamak reddedilir.

Son önerinin tüm öğeleri bounds, Home controls ve rectangle collision kurallarıyla doğrulanır. Başarısız öneri null döner; spatial hedef hesaplaması aynı hareket içinde çalışır. Ekran sınırı veya engel nedeniyle sessiz wrap/repacking yapılmaz. Normal collision kuralları gevşetilmez.

useSpatialDrag'ın opsiyonel insertion callback'leri Home'a transient override gönderir. HomeView yalnızca movedItems konumlarını render override olarak kullanır; source kendi pointer-driven visual'ını kullanmaya devam eder. JSON layout anahtarı aynı öneriyi tekrar yayınlamayı önler; pointer görseli rAF ile güncellenir. CSS home-spatial-item left/top geçişleri 180ms'dir; aktif dragged öğenin transition'ı kapalıdır. Reduced-motion geçişleri kapatır.

Pointer insertion bölgesinden çıkınca override temizlenir ve komşular kaydedilmiş konuma döner. Pointercancel, capture kaybı, Escape, blur ve unmount rAF/candidate/preview/capture temizliğini yapar. Cancel source'u başlangıç konumuna döndürür. Eşik altı tıklama ve klavye aktivasyonu korunur; drag sonrası pointer tıklaması bastırılır.

Pointerup öneriyi güncel prop geometrisi ve viewport ile yeniden hesaplar. insertionChanges dragged ID'yi tam bir kez ve movedItems'i üretir. useOtiumData.moveItems, services/workspacePositions üzerinden güncel snapshot'a uygular; boş/tekrarlı changes, kayıp ID, duplicate workspace ID, kesirli koordinat, bounds/controls veya collision hatasında publish etmez. Tüm konumlar tek snapshot olarak ortak yazım kuyruğuna gider. Storage hatasında snapshot ve source görseli geri alınır; komşular kalıcı olmayan konumda kalmaz. Pointermove storage yazmaz.

Doğrulama: saf intent/hysteresis, sparse-row reddi, karma boyutlar, source boşluğu, sağ zincir, unrelated/swept obstacle, controls/bounds, değişmeyen nesne kimliği ve final-layout testleri; hook'ta pointer-driven source, aynı layout'ı yeniden yayınlamama, leave/cancel/Escape/blur temizliği; batch path'te tek write, reload ve tam rollback. Gerçek tarayıcı pointer fixture'ında Link ve Project insertion, Project komşu, bırakmadan önce kaymış komşularla sıfır storage write, bırakmada tek write, leave sonrası restore, boş alan sürükleme, normal link/proje aktivasyonu, 900px viewport fallback, 120px ayar ve iki tema kontrol edildi. Pointercancel/global abort harness ile sınandı; gerçek Brave storage bu fixture ile doğrulanmış sayılmaz.

İlk sürüm sınırları: yatay ve konservatif aynı satır ilişkisi; uçlara ekleme hedefi ve dikey insertion yok. Giriş bölgesi dar olduğundan kasıtlı pointer hedefleme gerekir. Final batch tüm workspace'i doğrular; mevcut offscreen/orphan veya çakışan kayıtlar normal spatial drag çalışsa da insertion'ı engelleyebilir. Çoklu sekme snapshot yarışları önceki sınır olarak sürer. Gelecekteki item türleri saf öneri için boyut sağlamalı, renderer'da aynı footprint'i kullanmalı ve ortak batch validation yolundan geçmelidir.


Home ProjectButton güncellemesi: başlık tek satır ve ellipsis; veri ve accessible label tam adı korur. Sağ alt metadata absolute right:10px/bottom:-12px ile kenarı aşar ve sola büyür. 24px ikon/8px örtüşme/4 ikon/+N korunur. Dekoratif içerik pointer-events:none; metadata üzerinde boş pseudo yüzey ebeveyn düğmenin click/drag olaylarına katılır, collision kutusunu büyütmez. Uzun adlar 3× ile sınırlıdır; eksik proje referansı deterministik 1× footprint kullanır. Drag/reflow algoritması ve Builder/ProjectsView değişmez.

## Responsive Home ve proje renkleri

Home, `useWorkspaceViewport` ile resize olayını rAF içinde izler. `workspaceGeometryForViewport` sidebar/padding/kontrol kısıtlarının tek geometry kaynağıdır. `projectWorkspaceToViewport` önce geçerli kanonik dikdörtgenleri ayırır, sonra sığmayanları gerçek boyutlarıyla en yakın boş grid konumuna yerleştirir. Gerekirse yükseklik sınırlı adımlarla uzar ve `.active-view` dikey kaydırılır. Yatay kaydırma kapalıdır. Pencere küçülmesi saklanan x/y üzerinde yazım üretmez; büyütülünce kanonik yerleşim geri gelir. Fiziksel genişlik tek bir nesneden bile dar ise o nesne için geçici yer bulunamaz; uygulama pencereyi genişletme uyarısı gösterir.

SpatialDrag başlangıç için görünen öğe konumunu ve o anki gösterim geometrisini kullanır. Normal drop yalnızca sürüklenen öğenin hedefini, insertion ise sürüklenen ile gerçekten reflow edilen komşuları kanonik veriye kaydeder. Sadece projeksiyonla yer değiştiren diğer öğeler kaydedilmez. Görünür insertion kanonik satırda ek komşulara çarpıyorsa canonicalInsertionForProjection aynı hedefi doğrulayarak o gerçek reflow komşularını da batch içine alır. Dikey uzatılmış alana açık bir drop kalıcı koordinat olabilir.

Project.color isteğe bağlı semantic palette anahtarıdır: neutral, slate, blue, teal, green, amber, rose, violet. Eski kayıtlarda yokluğu neutral olarak görünür; bilinmeyen değer parser tarafından atılır. Açık/koyu yüzey ve nokta renkleri CSS değişkenleriyle ayrı tanımlanır. Home düğmesinin sol üstündeki ayrı renk düğmesi SpatialDrag olaylarını başlatmaz. Palet dış tıklama veya Escape ile kapanır. Renk seçimi proje servisinden tek snapshot olarak kaydedilir; Builder ve ProjectsView değişmez.


## Home span geometrisi

Önceki itemSize × tier hesabı, sağ kenar + 10px değerini her tier için ayrı 32px grid sınırına yuvarlıyordu. Bu yüzden aynı satırdaki 1/2/3 tier boşlukları farklıydı. Eski itemSize kullanan üretim yolu bulunmadı; sorun ortak genişlik formülündeydi.

utils/homeLayout.ts taban span hesabını paylaşır: columns = ceil((itemSize + 10) / 32), pitch = columns × 32, gap = pitch − itemSize, width(n) = n × pitch − gap. Sonraki kompakt başlangıç n × pitch uzaktadır. Ayarlar artık yalnızca 32px grid katlarını ürettiği için bütün desteklenen boyutlarda gap 32px olur. Başlangıçlar grid üzerindedir; sağ kenarların aynı grid kalıntısını paylaşması yeterlidir.

| itemSize | grid | span sütun/px | Link/P1 | P2 | P3 | boşluk | sonraki başlangıç uzaklığı P1/P2/P3 |
|---|---|---|---|---|---|---|---|
|64|32|3/96|64|160|256|32|96/192/288|
|96|32|4/128|96|224|352|32|128/256/384|
|128|32|5/160|128|288|448|32|160/320/480|
|160|32|6/192|160|352|544|32|192/384/576|

projectDimensions metin tahminini bu gerçek genişliklerle karşılaştırır. getWorkspaceItemDimensions üzerinden render, collision, drag preview, insertion ve viewport projection aynı ölçüyü kullanır. Görsel kart dikdörtgeni değişmez; geçerli konumlar diğer kartlardan en az WORKSPACE_ITEM_GAP mesafede olmalıdır. getNextCompactGridX insertion zincirini aynı pitch hesabıyla ilerletir. Serbest spatial drag grid hareketini korur; manuel koordinatlar otomatik kompaktlaştırılmaz. Açılışta koordinat migration veya resize kaynaklı storage yazımı eklenmedi.

architecture.mjs 64/96/128/160 boyutlarında bütün tier genişliklerini, eşit aralıkları, tier seçimlerini ve her kaynak tier ile atomik insertion zincirini doğrular. span-home.html geliştirme fixtureı gerçek Home bileşenlerini sahte chrome.storage/tabs ile çalıştırır.

## Grid hizalı görünüm boyutları

domain/settings.ts boyut modelinin tek kaynağıdır: minimum 2 × GRID_SIZE (64), varsayılan 3 × GRID_SIZE (96), maksimum 5 × GRID_SIZE (160) ve slider adımı GRID_SIZE (32). Kullanıcı arayüzü piksel değerini ve canlı Link önizlemesini göstermeye devam eder; grid çarpanı kullanıcıya sunulmaz.

normalizeItemSize ayar sınırında sonlu olmayan değerleri 96'ya düşürür, sayısal değerleri en yakın grid katına yuvarlar ve 64–160 aralığına sınırlar. Eşit uzaklıktaki değerlerde üst seçenek seçilir. parseSettings bu yardımcıyı kullanır. Repository geçersiz eski bir değer yüklediğinde aynı snapshotı normalize edilmiş ayarla bir kez kaydeder; WorkspaceItem x/y değerleri değişmez. useOtiumData da kullanıcı arayüzünden gelen değeri aynı sınırda normalize eder ve boyut değişikliğinde kanonik yerleşimi yeniden yazmaz. Çakışmalar yalnızca mevcut geçici responsive projection ile ekranda çözülür.

Home insertion regresyon düzeltmesi: Kanonik konumların boyut değişiminde korunması, ilgisiz eski çakışmaların var olmasını mümkün kılar. Toplu insertion doğrulaması bu nedenle değişen öğelerin gerçek dikdörtgenlerini bütün sonuç yerleşimine karşı kontrol eder; dokunulmayan öğeleri taşımaya zorlamaz. Yeni çakışmalar reddedilir. Ekrandaki sol insertion komşusu projekte edilmişse, kanonik öneri ekranla uyuşmadığında bu komşunun konumu yalnızca o açık insertion hareketinin parçası olarak kaydedilir. Diğer geçici projeksiyon konumları saklanmaz. Geçersiz öneri sessiz bir serbest drop'a dönüşmez. Proje genişlik/tier hesabı ve viewport projeksiyon algoritması korunmuştur.

## Bütün Home öğeleri için minimum mesafe

WORKSPACE_ITEM_GAP = GRID_SIZE artık serbest sürükleme dahil bütün yeni Home konumlarına uygulanır. workspace.ts içindeki hasRequiredClearance gerçek iki dikdörtgen arasında en az bir eksende bir grid hücresi boşluk arar. isValidPosition bu ortak kontrolü kullanır; findNearestFreePosition, SpatialDrag hedefi/commit, ilk yerleşim, insertion sonuç doğrulaması ve geçici viewport projection aynı kurala uyar. Kontrollerin kendi engel dikdörtgenleri ve Project boyutları değişmez. Kaydedilmiş eski konumlar açılışta yeniden yazılmaz; mesafesi yetersiz olanlar ekranda geçici olarak projekte edilir. Resize storage yazmaz.

## Güncel 20px grid kararı

Bu karar önceki 32px boyut tablolarının yerini alır: GRID_SIZE = 20, WORKSPACE_ITEM_GAP = 20, VISUAL_DOT_SPACING = GRID_SIZE × 2 = 40px. Settings minimum/default/maksimum çarpanları 1/4/6; seçenekler 20/40/60/80/100/120 ve varsayılan 80px olur. Mevcut normalizeItemSize ve tek seferlik repository yazımı aynı şekilde çalışır: 64→60, 82→80, 92/96/104→100, 128/160→120. Kanonik x/y tamsayıları ve schema değişmez; aynı koordinatlar artık 20px adımla piksele çevrilir. Project tier/span, insertion ve projection algoritmaları yeniden tasarlanmadı; mevcut merkezi grid değerini tüketir. Home ve Builder noktalı arka planları ayrı --visual-dot-spacing değişkenini kullanır; snap çözünürlüğünü etkilemez.
