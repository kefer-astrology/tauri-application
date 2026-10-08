---
title: 'Ajustes y apariencia'
description: 'Valores predeterminados de cálculo y apariencia de la aplicación.'
weight: 50
---

Abra **Ajustes** al final de la barra principal. Incluye idioma y ubicación, sistema de casas, objetos observados, aspectos, símbolos y diseño.

## Valores predeterminados de cálculo

Estos valores sirven a cartas nuevas y vistas sin elección propia; no modifican una carta guardada. La interfaz permite **Čeština**, **English**, **Français** y **Español**. Busque el lugar predeterminado o introduzca coordenadas; **Zona horaria** es el valor inicial de una carta nueva. El nombre del lugar es descriptivo: coordenadas y hora son las entradas de cálculo.

**Sistema de casas** muestra sistemas que el backend Rust/JPL puede calcular y cambia las cúspides. **Aparente** usa posiciones aparentes y correcciones; **Geométrica / verdadera** usa el vector sin corregir. Esta pantalla no tiene selector de motor; vea [Efemérides y cobertura](../../developer/ephemeris-manager/).

## Objetos y aspectos

Seleccione cuerpos y puntos para cartas nuevas. La lista está en [Objetos, aspectos y patrones de carta](../objects-aspects-and-patterns/#objetos-observables). La selección no instala datos ni garantiza cobertura. Las estrellas fijas se pueden filtrar por latitud eclíptica, pero el backend aún no las calcula.

**Escuela** sustituye aspectos activos, orbes y participación de ángulos, no casas, objetos ni motor. Consulte [Escuelas y ajustes de aspectos](../objects-aspects-and-patterns/#escuelas-y-ajustes-de-aspectos). Cada aspecto admite activación, color, orb de 0–30° por 0,5°, ángulos y orb extendido. Las líneas de aspecto del radix cambian solo el dibujo, no el cálculo.

## Símbolos y diseño

Elija glifos predeterminados/modernos, iconos predeterminados/alternativos, conjuntos de texto de grados disponibles, colores de elementos y ajustes en el gestor de glifos. La rueda minimalista tiene anillo zodiacal y 12 divisores; la técnica añade escala de 360°. **Borde izquierdo del radix** sitúa ASC o 0° de Aries a la izquierda sin cambiar casas, posiciones ni aspectos; es local al dispositivo.

Elija **Sunrise**, **Noon**, **Twilight** o **Midnight**. La paleta ajusta paneles, lienzo, textos, acento y fondos; la vista monocromática solo desatura. **Guardar** confirma paleta y colores de elementos y **Cancelar** restaura los campos no guardados. Las preferencias visuales pueden no viajar a otro equipo.
