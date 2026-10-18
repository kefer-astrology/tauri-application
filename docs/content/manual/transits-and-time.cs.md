---
title: 'Tranzity a čas'
description: 'Prozkoumejte měnící se pozice a posouvejte horoskop v čase.'
weight: 40
---

Otevřete **Tranzity** a porovnejte vybraný radix horoskop s pozicemi pro jiný
okamžik. Radix zůstává pevný; vybraná **tranzitující tělesa** se pohybují
obdobím a porovnávají se s vybranými **tranzitovanými tělesy** radixu. Vedlejší
navigace obsahuje Obecné, Tranzitovaná tělesa, Tranzitující tělesa a Aspekty.

## Výpočet rozsahu tranzitů

1. Jako typ zvolte **Tranzit**. Primární a sekundární direkce jsou viditelné,
   ale zatím nedostupné.
2. Vyberte zdrojový radix. V pracovním prostoru používá výpočet řady uložený
   horoskop; vybraný horoskop zůstává pevnou referencí.
3. Vyberte období: **Aktuální** vypočítá jeden okamžik po stisknutí
   **Vypočítat**; předvolby příštích/předchozích 3 nebo 6 měsíců a roku vytvoří
   rozsah při svém zvolení; **Vlastní** umožní upravit datum i čas začátku a konce.
4. Vyberte pohybující se (**tranzitující**) objekty, pevné radixové
   (**tranzitované**) objekty a aspekty. Seznamy jsou nezávislé, takže objekt
   může být v obou — například pro návrat k vlastní nativní pozici.
5. Pro rozsah se vzorkovaným výstupem zvolte kladný interval v sekundách,
   minutách, hodinách nebo dnech a stiskněte **Vypočítat**.

Vzorkovaný výsledek je řada snímků v daném intervalu. Menší interval vytvoří
hustší graf či tabulku, ale nezpřesní hledání přesných událostí. Velmi husté či
dlouhé rozsahy mohou překročit limit výpočtu; při vysokém odhadu vzorků zvolte
hrubší interval.

Datum a čas se zadávají v místním čase prohlížeče a odesílají se jako konkrétní
okamžik. Textová pole časového pásma jsou zatím vypnuté zástupné prvky; chcete-li
změnit časový základ horoskopu, použijte nastavení místa a časového pásma zdroje.

## Čtení výsledků

Se zapnutým vzorkovaným výstupem nabízí výsledky graf **Rezonance** a řaditelnou
tabulku aktivity aspektů. Rezonanci lze přiblížit v čase i vzdálenosti orbu a
postranní panel Vrstvy zobrazí nebo skryje všechny vlny navázané na vybrané
tranzitované těleso. Nejbližší přiblížení ve vzorkovaném grafu není náhradou za
přesnou událost.

Otevření vzorkovaného zásahu, přesné události nebo hranice konfigurace vytvoří
tranzitní překrytí pro daný okamžik vůči stejnému radixu; samotný radix nemění.

## Přesné události, stanice a konfigurace

Tyto volitelné hledání jsou nezávislé na vzorkování grafu. Pokud potřebujete
jen je, můžete vypnout **Vzorkovaný výstup grafu**.

- **Přesné události** hledají výpočtem kořene okamžik přesnosti vybraného
  aspektu, včetně párů tranzit–radix i tranzit–tranzit; mohou tedy ležet mezi vzorky.
- **Stanice** hledají body obratu přímého a retrográdního pohybu.
- **Víceobjektové konfigurace** hledají interval, kdy velký trigon,
  T-kvadratura, Yod nebo velký kříž zůstává v orbu.

Ovládání rolí konfigurace může omezit tělesa pro jednotlivé role a držet
vybrané role na radixových pozicích. Konfigurace tak může kombinovat pohybující
se tělesa s pevnými nativními cíli. **Nejlepší shoda** je nejtěsnější shoda
v orbu, ne tvrzení, že jsou všechny aspekty přesné současně.

Událost nebo konfiguraci lze otevřít jako horoskop v daném okamžiku. Varování
nebo neúplný výsledek znamená, že období nemá použitelné pokrytí efemeridami
nebo že omezené hledání nedokončilo práci. Některé blízké kontakty jsou označeny
jako tečné či nepotvrzené; prázdný neúplný seznam není důkazem, že se žádná
událost nestala.

## Současná omezení

Viditelné volby přechodů domů, přechodů znamení, limitů tranzitu a obecné
precese jsou zatím vypnuté zástupné prvky. Pole časového pásma také nejsou v
tomto zobrazení k dispozici. **Dynamika** sdílí časově orientovanou oblast,
ale primární ani sekundární direkce zatím nezpřístupňuje.

Je-li jinde v aplikaci dostupná navigace v čase, zvolte před krokem vzad nebo
vpřed jednotku a množství. Kalendářní jednotky, jako měsíce a roky, se uplatňují
jako změny kalendáře, nikoli jako pevný počet sekund.
