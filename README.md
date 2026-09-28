# 🏍️ Garage — Mantenimiento de motos

Aplicación web para llevar el mantenimiento de varias motos:

| Moto | Años | Intervalos en |
|---|---|---|
| **Suzuki GSX-R 600 K6** | 2006 – 2007 | kilómetros |
| **Suzuki DR-Z 400 S/SM** | 2006 | kilómetros |
| **Yamaha YZF-R6** | 2004 | kilómetros |
| **KTM 1290 Super Duke R** | 2017 | kilómetros |
| **KTM 1290 Super Adventure S** | 2022 | kilómetros |
| **KTM 250 EXC 2T** | 2009 | horas de motor |

Se cambia de moto con el desplegable de arriba a la izquierda. Funciona en el navegador, se puede instalar en el móvil como app y no necesita conexión ni servidor: los datos se guardan en tu dispositivo.

**👉 Úsala aquí:** https://antoniogarfer12.github.io/gsxr600-k6-mantenimiento/

## Qué hace

- **Varias motos**: cada una con su historial, su contador (km u horas de motor) y su plan de mantenimiento. Las KTM usan el color naranja.
- **Historial de mantenimiento**: registra fecha, km/horas, trabajos realizados, coste y notas.
- **Qué toca y cuándo**: a partir de cada mantenimiento calcula la próxima revisión de cada tarea y cuánto falta (km, horas o meses), con avisos de *vencido* / *pronto*.
- **Recordatorios**: notificaciones cuando se acerca un mantenimiento de cualquiera de tus motos (antelación configurable), aviso para actualizar el contador y exportación de los próximos mantenimientos al calendario del móvil (.ics, funciona también en iPhone). Con tus lecturas del contador calcula tu ritmo de uso y estima las fechas.
- **Guía de cada tarea**: paso a paso, herramientas y llaves necesarias, recambios y **pares de apriete**.
- **Ficha técnica** de cada moto con especificaciones y buscador de pares de apriete.
- **Copia de seguridad**: exporta/importa los datos de todas las motos en JSON (también importa copias de la versión anterior, que sólo tenía la GSX-R).

## Instalar en el móvil

Abre el enlace en el móvil → menú del navegador → **"Añadir a pantalla de inicio"**. Se abrirá como una app y funcionará sin conexión.

## Uso en local

Descarga el repositorio y abre `index.html` en el navegador. No requiere instalación.

## Estructura

```
index.html                   Interfaz
css/styles.css               Estilos
js/bikes/common.js           Lista de motos y categorías (formato de los datos)
js/bikes/gsxr600k6.js        Suzuki GSX-R 600 K6: plan, guías, herramientas y pares
js/bikes/drz400.js           Suzuki DR-Z 400 S/SM 2006
js/bikes/yzfr6.js            Yamaha YZF-R6 2004 (5SL)
js/bikes/superduke1290r.js   KTM 1290 Super Duke R 2017
js/bikes/superadventure1290s.js  KTM 1290 Super Adventure S 2022
js/bikes/exc250.js           KTM 250 EXC 2T 2009 (en horas de motor)
js/app.js                    Lógica (cálculo de próximos mantenimientos, historial, etc.)
js/store.js                  Calendario de avisos compartido con el service worker (IndexedDB)
sw.js                        Service worker (uso sin conexión y avisos en segundo plano)
```

Para ajustar intervalos o pares de apriete, edita el archivo de la moto en `js/bikes/`. Para añadir otra moto, crea un archivo nuevo con el mismo formato (se explica en `js/bikes/common.js`), añádelo en `index.html` y en `sw.js`.

## Fuentes y aviso

- GSX-R 600 K6: manual de servicio de Suzuki.
- DR-Z 400 S/SM 2006: manual de servicio de Suzuki DR-Z400S/SM (2000–2009).
- YZF-R6 2004 (5SL): manual de usuario Yamaha (plan europeo y capacidades) y manual de servicio 5SL (pares y holguras).
- 1290 Super Duke R 2017: manual de usuario oficial de KTM (plan de mantenimiento, capacidades y pares de apriete).
- 1290 Super Adventure S 2022: manual de usuario oficial de KTM.
- 250 EXC 2009: manual de usuario oficial de KTM 2009 para 125–300 EXC/XC, plan para **uso de ocio** (en competición los intervalos son más cortos).

Los datos son orientativos. Comprueba siempre los valores críticos (pares de apriete, holguras, medidas de llaves) en el manual de taller de tu unidad. Si no te ves seguro con un trabajo, acude a un taller.
