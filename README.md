# Karan Fleet 🚗 — गाड़ी हिसाब + GST बिल + सैलरी स्लिप (Offline + Google Drive Sync)

एक app में: हर गाड़ी का तेल/सर्विस/ड्राइवर/आमदनी-खर्च, महीने का **profit/loss व माइलेज**, **कागज़ात reminder** (Insurance/PUC/Fitness/Permit/Road Tax), **दैनिक KM व घंटे** लॉग (जिससे extra-km व extra-hour अपने-आप), और **Karan Tours + J K Enterprises** दोनों के **GST बिल / सैलरी स्लिप / मासिक सारांश PDF**।

- 📴 **Offline चलता है** — data आपके डिवाइस में (localStorage)
- ☁️ **Google Drive auto-sync** — Google से login करने पर data आपके Drive में backup/sync (किसी भी डिवाइस पर वही data)
- 📱 **APK बन सकता है** — PWABuilder से (नीचे देखें)
- 🎨 Black theme

डिफ़ॉल्ट में आपकी असली 17 गाड़ियाँ, 5 विभाग और दोनों companies पहले से भरी हैं।

---

## A) लैपटॉप पर चलाना (2 मिनट)

```bash
npm install
npm run dev
```
फिर ब्राउज़र में `http://localhost:3000` खोलें।

Production/host के लिए:
```bash
npm run build      # static files "out/" फ़ोल्डर में बन जाती हैं
```
(`out/` फ़ोल्डर पहले से इस ZIP में भी है — सीधे host कर सकते हैं।)

---

## B) Online host करना (ताकि फ़ोन/APK में चले + Google login हो)

Google login और APK के लिए app का **public HTTPS link** चाहिए। सबसे आसान — **Vercel** (free):

1. [vercel.com](https://vercel.com) पर Google से sign up
2. इस फ़ोल्डर को GitHub पर डालें **या** Vercel CLI:
   ```bash
   npm i -g vercel
   vercel          # सवालों में default दबाते जाएँ
   ```
3. आपको एक link मिलेगा, जैसे `https://karan-fleet.vercel.app` — यही आपका app है।

(विकल्प: **Netlify Drop** — netlify.com/drop पर `out/` फ़ोल्डर drag-drop कर दें, तुरंत link मिल जाता है।)

---

## C) Google Drive sync चालू करना (एक बार का setup)

1. [console.cloud.google.com](https://console.cloud.google.com) खोलें → ऊपर एक **New Project** बनाएँ (नाम: Karan Fleet)
2. बाएँ मेनू → **APIs & Services → Library** → "**Google Drive API**" खोजें → **Enable**
3. **APIs & Services → OAuth consent screen** → User type **External** → अपना नाम/ईमेल भरें → Save. "Test users" में अपना Gmail जोड़ें।
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** में अपने app के link जोड़ें:
     - `http://localhost:3000`
     - आपका Vercel/Netlify link (जैसे `https://karan-fleet.vercel.app`)
   - Create → एक **Client ID** मिलेगा (`...apps.googleusercontent.com`)
5. App खोलें → ऊपर ⚙️ **Settings → Google Drive Sync** → वह Client ID पेस्ट करें → **Google Login**
6. अब हर बदलाव अपने-आप आपके Drive में save होगा (ऊपर बादल ☁️ हरा = जुड़ा हुआ)।

> Drive में data app के **private appData फ़ोल्डर** में `karan-fleet-data.json` के रूप में रहता है (आपके Drive की list में दिखेगा नहीं, पर आपके account से जुड़ा रहेगा)।

Backup फ़ाइल भी बना सकते हैं: Settings → Backup → **बैकअप फ़ाइल** (उसे चाहें तो Drive/Gmail में रख लें)। **रिस्टोर** से वापस।

---

## D) APK बनाना (PWABuilder — free, Google login चलता है)

1. [pwabuilder.com](https://www.pwabuilder.com) खोलें
2. अपना app का link (Vercel/Netlify वाला) डालें → **Start**
3. **Android** → **Generate Package** → download (signed APK/AAB)
4. APK को फ़ोन में install करें

> यह APK Chrome engine (TWA) पर बनता है, इसलिए इसमें **Google login और Drive sync काम करते हैं** — WebView वाले APK में नहीं चलते।
> Play Store पर डालना हो तो PWABuilder का AAB इस्तेमाल करें।

Google OAuth के "Authorized origins" में APK के लिए अलग से कुछ नहीं चाहिए (TWA आपके वेबसाइट origin से ही चलता है)। अगर login में दिक़्क़त आए तो सुनिश्चित करें कि आपका host-link origins में जुड़ा है।

---

## फ़ाइलें
- `app/` — Next.js UI shell (page + black-theme CSS)
- `lib/fleet-core.js` — पूरा app (गाड़ी, बिल, स्लिप, कैशबुक, PDF)
- `lib/drive-sync.js` — Google Drive sync
- `public/` — manifest, service worker, icons

बदलाव/नए feature चाहिए तो बताइए। 🙏
