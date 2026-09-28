// Motos del garaje. Cada archivo de js/bikes/ añade una con BIKES.push({...}):
//   id, brand ('suzuki' | 'ktm': color de la interfaz), short (nombre en el selector), name, years
//   unit: 'km' o 'h' (horas de motor): unidad de los intervalos, el contador y los registros
//   before: con cuántas unidades de antelación avisar por defecto
//   source: de dónde salen los datos (se muestra en la ficha)
//   specs: [{ label, value }]
//   tasks: [{ id, name, category, every, months, first, resets, duration, difficulty, tools, parts, torques, steps, tips }]
//     every: intervalo en la unidad de la moto (null = sólo por tiempo)
//     months: intervalo en meses (null = sólo por uso)
//     first: primera revisión si difiere del intervalo (rodaje)
//     resets: al hacer esta tarea se da por hecha también la indicada
// Verifica siempre los valores críticos con el manual de taller de tu unidad.

const BIKES = [];

// Categorías para agrupar y colorear
const CATEGORIES = {
  motor: { label: 'Motor', color: '#3b82f6' },
  transmision: { label: 'Transmisión', color: '#f59e0b' },
  frenos: { label: 'Frenos', color: '#ef4444' },
  chasis: { label: 'Chasis', color: '#10b981' },
  refrigeracion: { label: 'Refrigeración', color: '#06b6d4' },
  electrico: { label: 'Eléctrico', color: '#a855f7' },
};
