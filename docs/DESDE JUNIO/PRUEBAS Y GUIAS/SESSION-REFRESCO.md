# 🔄 SESSION-REFRESCO — PRUEBAS Y GUÍAS

> **Tipo: ESTADO.** Se lee primero y se escribe al final de cada sesión. Cabecera primero.

## En una frase

**2026-10-02 — P0 HECHA, P1 empezada, P2 BLOQUEADA por el navegador.** Carpeta, plan, catálogo (A1–A17,
E1–E13, T1–T9, R1–R2, reglas F de dinero leídas del código), hallazgos (H-001…H-009) y el verificador
de BD `scripts/qa/verificar-flujo.cjs` (probado en prod). Falta que Chrome se conecte para correr P2.
P1 ya dio el primer hallazgo serio: **H-010** (completar en efectivo no apaga el link de pago; si el
paciente lo paga después, Flujo no lo registra) — PLAUSIBLE, se confirma en P2 sin pagar nada.

## ⏭️ Siguiente — empieza aquí

1. **Desbloquear Chrome** (lo hace el usuario): la extensión exige que Claude Code y Chrome estén en la
   MISMA cuenta de claude.ai. El Chrome con la sesión de dr-prueba es el de **quebradita.a**; si Claude
   Code está en otra cuenta, `/login` con quebradita.a (o loguear la extensión en la cuenta de Claude
   Code — pero ese Chrome no tiene dr-prueba). Luego reiniciar Chrome si hace falta.
2. **P1 — pasada de escritorio** (no necesita Chrome): llenar los ⟨P1⟩ del catálogo desde el código
   (A1 correos/GCal, A4, A5, A8 link al completar, A9 eliminar, A12, A14, A15, A17, E5, E7, E8, E10–E12)
   y comparar cada uno con su sección del manual → 📝 en hallazgos.
3. **P2 — orden de corrida:** A1 → A6 → A7 → A9 → A10 → A13 (núcleo de agenda, con un paciente
   «QA A…» nuevo) · E1 → E3 → E4 → E5 → E9 (expediente núcleo) · T1 → T6 → T8 → T9 · R1. Cada flujo:
   pantalla (etiquetas exactas) + `verificar-flujo.cjs` + logs → bitácora → estado en el catálogo.
4. Por cada ✅: borrador de guía en `GUIAS/` (plantilla en `GUIAS/README.md`).

## Cómo verificar en la BD

```bash
railway run --service pgvector node scripts/qa/verificar-flujo.cjs <patientId | "QA A6"> [minutos]
```

Imprime citas (con su ingreso, visita y sesión), visitas (con conteos), ventas (con su ingreso),
movimientos de Flujo del paciente (avisa DUPLICADOS), tratamientos y la bitácora de los últimos N
minutos (★ = nuevo en la ventana).

## Decisiones del usuario (2026-10-02)

- Permiso COMPLETO para probar en prod (navegador, BD, logs) en Agenda, Expediente y su efecto en Flujo
  de Dinero. Flujo de Dinero sólo en lo que toca a esas áreas (que los ingresos se detecten), no sus
  permutaciones propias.
- Meta: saber si hay bugs, si hace lo que creemos, si los docs están al día (y corregirlos), y escribir
  las guías paso a paso — el soporte será guías + widget + videos, sin humanos. «Make it or break it».
- V5 (PDF resumen del tratamiento) espera hasta después de esta pasada.
