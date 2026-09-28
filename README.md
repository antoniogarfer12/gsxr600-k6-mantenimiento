# 🏍️ GSX-R Garage — Mantenimiento Suzuki GSX-R 600 K6

Aplicación web para llevar el mantenimiento de una **Suzuki GSX-R 600 K6 (2006-2007)**.
Funciona en el navegador, se puede instalar en el móvil como app y no necesita conexión ni servidor: los datos se guardan en tu dispositivo.

**👉 Úsala aquí:** https://antoniogarfer12.github.io/gsxr600-k6-mantenimiento/

## Qué hace

- **Historial de mantenimiento**: registra fecha, kilómetros, trabajos realizados, coste y notas.
- **Qué toca y cuándo**: a partir de los kilómetros de cada mantenimiento calcula la próxima revisión de cada tarea y cuántos km (o meses) faltan, con avisos de *vencido* / *pronto*.
- **Guía de cada tarea**: paso a paso, herramientas y llaves necesarias, recambios y **pares de apriete**.
- **Ficha técnica** con especificaciones y buscador de pares de apriete.
- **Copia de seguridad**: exporta/importa tus datos en JSON.

## Instalar en el móvil

Abre el enlace en el móvil → menú del navegador → **"Añadir a pantalla de inicio"**. Se abrirá como una app y funcionará sin conexión.

## Uso en local

Descarga el repositorio y abre `index.html` en el navegador. No requiere instalación.

## Estructura

```
index.html           Interfaz
css/styles.css       Estilos
js/data.js           Plan de mantenimiento, guías, herramientas y pares de apriete
js/app.js            Lógica (cálculo de próximos mantenimientos, historial, etc.)
sw.js                Service worker (uso sin conexión)
```

Para ajustar intervalos o pares de apriete, edita `js/data.js`.

## Aviso

Los datos son orientativos y están basados en el manual de servicio de la GSX-R 600 K6. Comprueba siempre los valores críticos (pares de apriete, holguras, medidas de llaves) en el manual de taller de tu unidad. Si no te ves seguro con un trabajo, acude a un taller.
