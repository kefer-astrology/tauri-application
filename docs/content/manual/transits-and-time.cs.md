---
title: 'Tranzity a čas'
description: 'Prozkoumejte měnící se pozice a posouvejte horoskop v čase.'
weight: 40
---

Otevřete **Tranzity** a porovnejte vybraný radix horoskop s pozicemi pro jiný okamžik. K výběru dostupné operace tranzitu použijte jeho vedlejší navigaci.

## Výpočet rozsahu tranzitů

1. Jako typ zvolte **Tranzit**. Primární a sekundární direkce jsou viditelné
   jako budoucí práce, ale zatím je nelze vybrat.
2. Vyberte zdrojový radix horoskopu. Výpočet tranzitů vyžaduje uložený horoskop.
3. Pro jeden aktuální okamžik zvolte **Aktuální**, nebo pro období **Vlastní**
   a zadejte počáteční a koncové datum a čas.
4. Vyberte pohybující se objekty, radixové cílové objekty a aspekty.
5. Zvolte interval vzorkování grafu a stiskněte **Vypočítat**.

Vzorkovaný výsledek je řada snímků v daném intervalu. Menší interval vytvoří
hustší graf či tabulku, ale nezpřesní hledání přesných událostí. Výsledky lze
zobrazit jako horoskop nebo tabulku; vybraný radix zůstává pevným referenčním bodem.

## Přesné události, stanice a konfigurace

Tyto volitelné hledání jsou nezávislé na vzorkování grafu. Pokud potřebujete
jen je, můžete vypnout **Vzorkovaný výstup grafu**.

- **Přesné události** hledají okamžik přesnosti vybraného aspektu.
- **Stanice** hledají body obratu přímého a retrográdního pohybu.
- **Víceobjektové konfigurace** hledají interval, kdy velký trigon,
  T-kvadratura, Yod nebo velký kříž zůstává v orbu.

Událost nebo konfiguraci lze otevřít jako horoskop v daném okamžiku. Varování
nebo neúplný výsledek znamená, že období nemá použitelné pokrytí efemeridami
nebo že omezené hledání nedokončilo práci; prázdný neúplný seznam není důkazem,
že se žádná událost nestala.

## Současná omezení

Viditelné volby přechodů domů, přechodů znamení, limitů tranzitu a obecné
precese jsou zatím vypnuté zástupné prvky. Pole časového pásma také nejsou v
tomto zobrazení k dispozici. **Dynamika** sdílí časově orientovanou oblast,
ale primární ani sekundární direkce zatím nezpřístupňuje.

Je-li jinde v aplikaci dostupná navigace v čase, zvolte před krokem vzad nebo
vpřed jednotku a množství. Kalendářní jednotky, jako měsíce a roky, se uplatňují
jako změny kalendáře, nikoli jako pevný počet sekund.
