/**
 * «Dr. <nombre>» — sin repetir el título cuando el nombre guardado ya lo trae (H-033: el formulario
 * pre-cita decía «Dr. Dr. Gerardo…»). Respeta «Dra.» si ya viene.
 */
export function conTituloDoctor(nombre: string): string {
  const n = nombre.trim();
  // «Dr.», «Dra.», «Dr.Juan», «DRA», «Doctor», «Doctora» … ya traen título.
  return /^(dra?|doctora?)\b\.?/i.test(n) ? n : `Dr. ${n}`;
}
