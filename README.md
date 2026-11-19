# Majstor blizu

Angular 19 aplikacija za pronalaženje najbližeg mehaničara, limara ili vulkanizera. Radi samo u pregledaču, bez backenda i baze.

## Pokretanje

Potrebno: **Node.js 20 LTS ili 22 LTS** (https://nodejs.org).

### Visual Studio 2022 (17.8+)
1. U Visual Studio Installer-u uključite workload **Node.js development**.
2. Otvorite `majstor-blizu.esproj` (File → Open → Project/Solution).
   - Ako projekat ne može da se učita: File → Open → Folder i izaberite ovaj folder.
3. Prvi put: desni klik na `npm` u Solution Explorer-u → **Install npm Packages** (ili u terminalu `npm install`).
4. F5 – pokreće `npm start` i otvara http://localhost:4200.

### Terminal / VS Code
```bash
npm install
npm start
```
Otvorite http://localhost:4200.

### Test na telefonu (ista Wi-Fi mreža)
Pregledači traže HTTPS za lokaciju, zato:
```bash
npm run start:lan
```
Na telefonu otvorite `https://<IP-računara>:4200` i prihvatite upozorenje o sertifikatu.

### Produkcija
```bash
npm run build
```
Rezultat je u `dist/majstor-blizu/browser/` – statički fajlovi za bilo koji hosting (Netlify, Vercel, Azure Static Web Apps, IIS…). Na serveru podesite da sve rute vraćaju `index.html`.

## Ekrani
- `/` – uvod (prikazuje se samo prvi put)
- `/lokacija` – dozvola za GPS ili ručni unos adrese
- `/mapa` – mapa + lista najbližih, filteri (Svi / Mehaničar / Limar / Vulkanizer) i radijus 2–20 km. Na desktopu se detalji otvaraju u kartici na mapi.
- `/majstor/:id` – profil (adresa, radno vreme, telefon, Pozovi, Navigacija)

## Izvori podataka (besplatni, bez API ključa)
- **Majstori:** OpenStreetMap preko Overpass API-ja (`shop=car_repair`, `shop=tyres`, `craft=car_repair`). Vrsta se određuje iz taga i naziva (npr. „vulkanizer“, „limarija“) – `src/app/services/mechanic.service.ts`, funkcija `classify`.
- **Adrese:** Nominatim (pretraga i obrnuto geokodiranje).
- **Mapa:** Leaflet + CARTO Voyager slojevi.

Ograničenja: OSM u Srbiji nema sve radnje, a telefon i radno vreme često nedostaju; nema ocena. Ako vam to bude bitno, `MechanicService` može da se zameni Google Places API-jem (ključ ograničite na vaš domen) ili malim .NET proxy-jem kasnije – ostatak aplikacije se ne menja.

## Struktura
```
src/app/
  models/mechanic.ts          tipovi, boje i nazivi vrsta
  services/location.service   GPS, pretraga adrese
  services/mechanic.service   Overpass upit, klasifikacija, udaljenost
  components/map/             Leaflet mapa sa pinovima
  pages/onboarding|location|finder|profile
  utils/format.ts             km, procena vremena, radno vreme na srpskom
```
