# Kaip atrodo ir elgiasi mūsų puslapiai

Trumpas sąrašas, kad klientų zona ir trenerio skydelis visada atrodytų ir veiktų vienodai,
nesvarbu, kas ir kada kuria naują puslapį. Kiekvieną naują funkciją tikriname pagal jį.

Automatinė dalis: `node scripts/tikrink-dizaina.mjs` (paleidžiama ir GitHub'e per pull request).

## 1. Mygtukai

- **Pagrindinis veiksmas** puslapyje: geltonas mygtukas (`btn btn-primary`). Vienas ekrane.
- **Visi kiti veiksmai:** kontūrinis mygtukas (`btn btn-ghost`).
- **Trynimas:** kontūrinis raudonas (`btn btn-danger`), ir visada dviem žingsniais: pirmas
  paspaudimas pavirsta raudonu klausimu, antras ištrina (`patvirtink()` faile `zona/app.js`).
  Jokių `confirm()` iššokančių langų.
- Mažesnė eilutė lentelėje ar kortelėje: `btn-sm`.
- Visa eilutė, kurią galima paspausti (pvz. užduotis klientui), yra vienas mygtukas, ne tik varnelė.

## 2. Pranešimai

- Sėkmė ar klaida po veiksmo trenerio skydelyje: viena vieta (`#pranesimas`), po pranešimo
  puslapis pastumiamas prie jo.
- Klientui: trumpas juodas pranešimas apačioje (`toast`), klaida raudona.
- Pranešimas niekada nepastumia viso puslapio ir nepaslepiamas po kitu elementu.
- Jei veiksmas nepavyko, klientas tai mato. Tylių nesėkmių nebūna.

## 3. Spalvos ir šriftas

- Spalvos tik iš sąrašo `zona/stilius.css` viršuje (`:root`). Nerašom `#ff0000` ar `rgb(...)`
  tiesiai į puslapį.
- Geltona tik pagrindiniam veiksmui ir „padaryta“ būsenai. Raudona tik trynimui ir tikrai
  blogoms būsenoms. Žalia tik „atlikta“.
- Šviesus fonas klientui. Tamsūs užpildyti blokai tik navigacijai ir antraštei.
- Vienas šriftas (Archivo), kaip dabar.

## 4. Tekstas

- Viskas, ką mato klientas, lietuviškai, natūraliai, be mašininio vertimo skonio.
- Tekstai klientui gyvena viename faile (`zona/tekstai.js`), ne išbarstyti po puslapius.
- Trumpai. Jei sakinį galima išmesti, išmetam. Trenerio ekrane daugiausia pavadinimai ir skaičiai,
  paaiškinimai tik ten, kur be jų neaišku.
- Neteisiame, nekaltiname: be „nepavyko“ klientui apie jo paties dieną. Tik faktai ir šilta žinutė.

## 5. Kiekvienas ekranas

- Veikia telefone (390 px pločio) prieš tai, kai laikoma baigtu.
- Į ekraną telpa viena pagrindinė mintis. Daugiau skiriam į skirtukus ar sulankstomus blokus,
  o ne į ilgą slinkimą.
- Mygtukas ar langelis, kurį spaudžia pirštu, ne mažesnis kaip apie 40 px.
- Jei duomenų nėra, rodomas aiškus paaiškinimas, ne tuščias plotas.

## 6. Duomenys ir saugumas

- Klientas niekada negali pakeisti to, kas priklauso treneriui (žinutės, užduotys, paketai).
  Tai užtikrina duomenų bazės taisyklės, ne paslėptas mygtukas.
- Kiekvienas naujas SQL failas veikia paleistas pakartotinai ir išbandytas ant tuščios bei
  jau veikiančios bazės.
- Kiekvienas pakeitimas keičia `?v=...` versiją VISUOSE failuose (patikra tai tikrina).

## Kaip naudoti

1. Prieš sakydamas „baigta“, perbėk šį sąrašą.
2. Paleisk `node scripts/tikrink-dizaina.mjs`. Jei nepraeina, pataisyk arba, jei senas
   pažeidimas tvarkomas vėliau, aiškiai sutark ir paleisk su `--atnaujink`.
3. Radęs dalyką, kuris kartojasi, įrašyk jį čia kaip naują taisyklę.
