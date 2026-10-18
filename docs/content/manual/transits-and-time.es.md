---
title: 'Tránsitos y tiempo'
description: 'Inspeccione posiciones cambiantes y desplace una carta a través del tiempo.'
weight: 40
---

Abra **Tránsitos** para comparar una carta radix seleccionada con las posiciones
de otro momento. El radix permanece fijo; los **cuerpos en tránsito** se mueven
por el período y se comparan con los **cuerpos transitados** del radix. La
navegación secundaria configura General, Cuerpos transitados, Cuerpos en
tránsito y Aspectos.

## Calcular un intervalo de tránsitos

1. Elija **Tránsito** como tipo. Las direcciones primarias y secundarias se
   muestran, pero todavía no están disponibles.
2. Elija la carta radix de origen. En un espacio de trabajo, la serie usa su
   carta guardada; la carta elegida sigue siendo la referencia fija.
3. Elija un período: **Actual** calcula un instante al pulsar **Calcular**; los
   preajustes de los próximos/anteriores 3 o 6 meses y año crean un intervalo
   al elegirlos; **Personalizado** permite editar fecha y hora de inicio y fin.
4. Seleccione objetos móviles (**en tránsito**), objetos radix fijos
   (**transitados**) y aspectos. Las listas son independientes: un objeto puede
   estar en ambas, por ejemplo para un retorno a su posición natal.
5. Para un intervalo con salida muestreada, elija un intervalo positivo en
   segundos, minutos, horas o días y seleccione **Calcular**.

El resultado muestreado es una serie de instantáneas. Un intervalo menor produce
un gráfico o tabla más denso, pero no hace más precisa la búsqueda de eventos.
Los intervalos muy densos o largos pueden superar el límite de cálculo; use un
paso más grueso cuando la estimación de muestras sea alta.

La fecha y la hora se introducen en la hora local del navegador y se envían como
un instante concreto. Los campos de texto de zona horaria son marcadores
desactivados; para cambiar la base temporal use los ajustes de lugar/zona de la carta de origen.

## Leer los resultados

Con salida muestreada, el área de resultados ofrece un gráfico de **Resonancia**
y una tabla ordenable de actividad aspectual. Puede ampliar Resonancia en tiempo
y distancia de orbe; la barra lateral Capas muestra u oculta todas las ondas
unidas a cada cuerpo transitado seleccionado. La aproximación más cercana del
gráfico muestreado no sustituye un evento exacto.

Abrir un impacto muestreado, un evento exacto o un límite de configuración crea
la superposición de tránsito para ese instante frente al mismo radix; no cambia
la carta radix.

## Eventos exactos, estaciones y configuraciones

Estas búsquedas opcionales son independientes del muestreo. Puede desactivar
**Salida de gráfico muestreada** si solo necesita estos resultados.

- **Eventos exactos** calcula por búsqueda de raíz cuándo un aspecto solicitado
  llega a ser exacto, incluso para pares tránsito–radix y tránsito–tránsito;
  por ello puede caer entre muestras.
- **Estaciones** busca los puntos de cambio entre movimiento directo y retrógrado.
- **Configuraciones de varios cuerpos** busca el intervalo en que un Gran
  trígono, T-cuadrada, Yod o Gran cruz permanece dentro del orbe.

Los controles de roles de una configuración pueden restringir los cuerpos que
ocupan cada papel y mantener papeles elegidos en posiciones radix. Así se pueden
combinar cuerpos móviles con objetivos natales fijos. El **mejor ajuste** es el
ajuste más cercano dentro del orbe, no que todos los aspectos sean exactos a la vez.

Puede abrir un evento o configuración como carta en ese instante. Una
advertencia o resultado incompleto indica falta de cobertura utilizable de
efemérides o que la búsqueda limitada no terminó. Algunos contactos cercanos se
marcan como tangenciales o no confirmados; una lista vacía incompleta no demuestra
que no ocurriera ningún evento.

## Limitaciones actuales

Los controles visibles de cruces de casas, cruces de signos, límites de tránsito
y precesión general son marcadores desactivados. Los campos de zona horaria
tampoco están disponibles en esta vista. **Dinámica** comparte el área temporal,
pero todavía no habilita direcciones primarias ni secundarias.

Cuando la navegación temporal esté disponible en otra parte de la aplicación,
elija unidad y cantidad antes de avanzar o retroceder. Meses y años se aplican
como cambios de calendario, no como números fijos de segundos.
