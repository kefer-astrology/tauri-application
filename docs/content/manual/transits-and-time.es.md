---
title: 'Tránsitos y tiempo'
description: 'Inspeccione posiciones cambiantes y desplace una carta a través del tiempo.'
weight: 40
---

Abra **Tránsitos** para comparar una carta radix seleccionada con las posiciones de otro momento. Use su navegación secundaria para elegir la operación de tránsito disponible.

## Calcular un intervalo de tránsitos

1. Elija **Tránsito** como tipo. Las direcciones primarias y secundarias se
   muestran como trabajo futuro, pero todavía no se pueden seleccionar.
2. Elija la carta radix de origen; el cálculo requiere una carta guardada.
3. Use **Actual** para un único instante actual o **Personalizado** para indicar
   fecha y hora inicial y final.
4. Seleccione los objetos en movimiento, los objetos radix de destino y los aspectos.
5. Elija el intervalo de muestreo del gráfico y seleccione **Calcular**.

El resultado muestreado es una serie de instantáneas. Un intervalo menor produce
un gráfico o tabla más denso, pero no hace más precisa la búsqueda de eventos.
Los resultados se pueden ver como carta o tabla; el radix seleccionado sigue
siendo el punto de referencia fijo.

## Eventos exactos, estaciones y configuraciones

Estas búsquedas opcionales son independientes del muestreo. Puede desactivar
**Salida de gráfico muestreada** si solo necesita estos resultados.

- **Eventos exactos** busca cuándo un aspecto solicitado llega a ser exacto.
- **Estaciones** busca los puntos de cambio entre movimiento directo y retrógrado.
- **Configuraciones de varios cuerpos** busca el intervalo en que un Gran
  trígono, T-cuadrada, Yod o Gran cruz permanece dentro del orbe.

Puede abrir un evento o configuración como carta en ese instante. Una
advertencia o resultado incompleto indica falta de cobertura utilizable de
efemérides o que la búsqueda limitada no terminó; una lista vacía incompleta
no demuestra que no ocurriera ningún evento.

## Limitaciones actuales

Los controles visibles de cruces de casas, cruces de signos, límites de tránsito
y precesión general son marcadores desactivados. Los campos de zona horaria
tampoco están disponibles en esta vista. **Dinámica** comparte el área temporal,
pero todavía no habilita direcciones primarias ni secundarias.

Cuando la navegación temporal esté disponible en otra parte de la aplicación,
elija unidad y cantidad antes de avanzar o retroceder. Meses y años se aplican
como cambios de calendario, no como números fijos de segundos.
