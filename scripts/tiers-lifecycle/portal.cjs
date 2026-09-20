// ¿El portal de clientes de Stripe deja CAMBIAR DE PLAN? (TIERS C3, R7)
// Sólo lectura contra la API de Stripe. Nunca imprime la clave.
const key = process.env.STRIPE_BILLING_SECRET_KEY;
if (!key) { console.log('🔴 no hay STRIPE_BILLING_SECRET_KEY en este entorno'); process.exit(1); }
console.log('modo:', key.startsWith('sk_test') ? 'PRUEBA' : key.startsWith('sk_live') ? 'VIVO' : '¿?');

(async () => {
  const res = await fetch('https://api.stripe.com/v1/billing_portal/configurations?limit=10', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const j = await res.json();
  if (j.error) { console.log('🔴 Stripe:', j.error.message); process.exit(1); }
  if (!j.data?.length) {
    console.log('🔴 NO hay ninguna configuración de portal: el portal no está configurado.');
    return;
  }
  for (const c of j.data) {
    const f = c.features || {};
    const su = f.subscription_update || {};
    const sc = f.subscription_cancel || {};
    console.log(`\nconfiguración ${c.id}${c.is_default ? '  (POR DEFECTO ← la que se usa)' : ''}`);
    console.log('  activa:', c.active);
    console.log('  CAMBIAR DE PLAN (subscription_update):', su.enabled ? '🔴 ENCENDIDO' : '✅ apagado');
    if (su.enabled) {
      console.log('     productos ofrecidos:', (su.products || []).length);
      console.log('     comportamiento de prorrateo:', su.proration_behavior);
    }
    console.log('  CANCELAR (subscription_cancel):', sc.enabled ? '✅ encendido' : '⚠️ apagado');
    if (sc.enabled) console.log('     modo:', sc.mode, '· prorrateo:', sc.proration_behavior);
    console.log('  actualizar forma de pago:', f.payment_method_update?.enabled ? 'sí' : 'no');
    console.log('  ver facturas:', f.invoice_history?.enabled ? 'sí' : 'no');
  }
})().catch((e) => { console.log('ERROR:', e.message); process.exit(1); });
