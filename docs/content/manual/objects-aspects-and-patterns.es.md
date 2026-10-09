---
title: 'Objetos, aspectos y patrones de carta'
description: 'Los objetos y aspectos integrados, y las formas y configuraciones que Kefer puede mostrar.'
weight: 35
---

Esta referencia enumera el catálogo integrado. Las opciones de **Ajustes** son
la autoridad final para el espacio de trabajo y motor concretos: un objeto puede
estar definido pero no disponible si un núcleo local de efemérides no lo cubre.

## Objetos observables

| Grupo | Objetos integrados |
| --- | --- |
| Luminarias y planetas | Sol, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno, Plutón |
| Ángulos | Ascendente, Medio Cielo, Descendente, Fondo del Cielo |
| Nodos lunares | Nodo Norte, Nodo Sur, Nodo Norte verdadero, Nodo Sur verdadero |
| Puntos calculados y lotes | Lilith, Lilith verdadera, Vértice, Antivértice, Parte de la Fortuna, Parte del Espíritu |
| Asteroides y centauros | Quirón, Ceres, Palas, Juno, Vesta, Astraea, Hebe, Iris, Flora, Metis, Hygiea, Parthenope, Victoria, Egeria, Irene, Eunomia, Psyche, Thetis, Melpomene, Fortuna, Massalia |

La ruta JPL calcula los puntos exclusivos de JPL y los asteroides ampliados si
los núcleos locales necesarios están presentes. La aplicación nunca descarga
efemérides silenciosamente durante un cálculo. Elija objetos en
[Ajustes y apariencia](../settings-and-appearance/).

## Aspectos disponibles

Todos los aspectos integrados se pueden activar, recibir un orbe y limitarse
por categoría de objeto en **Ajustes**. El conjunto predeterminado contiene
conjunción, sextil, cuadratura, trígono, quincuncio y oposición.

| Aspecto | Ángulo exacto |
| --- | ---: |
| Conjunción | 0° |
| Semisextil | 30° |
| Undécil | 32,727…° |
| Décil | 36° |
| Novil | 40° |
| Octil | 45° |
| Septil | 51,429…° |
| Sextil | 60° |
| Biundécil | 65,455…° |
| Quintil | 72° |
| Binovil | 80° |
| Triundécil | 98,182…° |
| Cuadratura | 90° |
| Biseptil | 102,857…° |
| Tridécil | 108° |
| Trígono | 120° |
| Cuatriundécil | 130,909…° |
| Trioctil | 135° |
| Biquintil | 144° |
| Quincuncio | 150° |
| Triseptil | 154,286…° |
| Cuadrinovil | 160° |
| Quindécil | 163,636…° |
| Oposición | 180° |

El ángulo exacto es fijo; el orbe es una tolerancia configurable. Un aspecto
solo aparece cuando lo permiten el modelo, la lista activa, la regla de
categorías y el orbe resultante.

## Escuelas y ajustes de aspectos

El selector **Escuela** de React es un preajuste de tradición astrológica.
Sustituye los aspectos activos por defecto, sus orbes y la inclusión de ángulos;
después puede ajustar cada aspecto en Ajustes. Por ahora no cambia objetos,
sistema de casas, zodiaco, ayanamsa, motor de cálculo ni el modelo subyacente.

| Tradición | Aspectos activos y orbe predeterminado |
| --- | --- |
| Helenística | Conjunción 10°, sextil 8°, cuadratura 9°, trígono 9°, oposición 10° |
| Tradicional medieval / renacentista | Conjunción 8°, sextil 6°, cuadratura 7°, trígono 8°, oposición 8° |
| Occidental moderna | Conjunción 8°, sextil 5°, cuadratura 6°, trígono 6°, quincuncio 2°, semisextil 1°, oposición 8° |
| Armónica / vibracional | Todos los aspectos integrados; orbe de catálogo de cada uno (0,5°–8°) |
| Cosmobiología | Conjunción, octil, cuadratura, trioctil, oposición — 2° cada uno |
| Uraniana / Hamburgo | Conjunción, octil, cuadratura, trioctil, oposición — 1,5° cada uno |
| Jyotish — Parāśari | Conjunción 8°, sextil 5°, cuadratura 6°, trígono 6°, oposición 8° |

El formato de espacio de trabajo tiene un segundo concepto distinto: una
**escuela activa** definida por el espacio elige su modelo de cálculo
predeterminado. No se limita a estas siete tradiciones ni mezcla
automáticamente ajustes de una relación `extends`.

## Formas y configuraciones de carta

Aspectario puede informar estos patrones calculados. Información, incluido su
prototipo Espectro, todavía no usa el resultado calculado de la carta seleccionada.
Los patrones describen una carta en su instante calculado, no objetos adicionales ni opciones de cálculo.

**Formas de distribución:** Haz, Cuenco, Locomotora, Cubo, Balancín,
Salpicadura, Dispersión, Centro desplazado y Stellium. La detección usa los
diez cuerpos clásicos (del Sol a Plutón) y requiere al menos siete.

**Configuraciones aspectuales:** T-cuadrada, Gran trígono, Gran cruz, Cometa,
Rectángulo místico, Doble quincuncio, Doble biquintil, Hexagrama y Pentagrama.
En tránsitos, **Yod** nombra la geometría de dos quincuncios y un sextil que
en la instantánea de carta se llama **Doble quincuncio**.
