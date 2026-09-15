# TOOLING — arrancar Claude Code con suscripción o con API key

_Setup de máquina (Windows + VS Code), no del repo. Hecho el 2026-09-14._

## Los dos comandos

```powershell
claude-sub    # sesión normal, con la SUSCRIPCIÓN (borra ANTHROPIC_API_KEY del entorno)
claude-api    # sesión facturada por API KEY (la lee de ~\.claude-api-key)
```

Ambos pasan los argumentos extra tal cual (`claude-sub --resume`, etc.).
Dentro de la sesión, `/status` dice con cuál credencial está corriendo.

## Dónde vive

| Qué | Dónde |
| --- | --- |
| Las dos funciones | `C:\Users\52331\OneDrive\Documents\WindowsPowerShell\profile.ps1` (perfil *all-hosts*: carga en la terminal normal y en la de VS Code) |
| La API key | `C:\Users\52331\.claude-api-key` — 108 bytes, herencia de ACL quitada, permiso sólo para el usuario. **Es la única copia**; si se borra hay que generar otra en console.anthropic.com |
| Respaldo del config | `C:\Users\52331\.claude.json.bak-2026-09-14` |

## El problema que esto resuelve

`ANTHROPIC_API_KEY` **no** estaba en ninguna variable de entorno persistente (ni User ni
Machine), ni en `.bashrc` (ahí está comentada), ni en los settings de VS Code. Estaba viva
**sólo en memoria**, heredada por la cadena de procesos:

```
explorer.exe → Code.exe (VS Code) → powershell.exe (terminal integrada) → claude.exe
```

Por eso cerrar la terminal **no** la quita: la terminal nueva vuelve a heredarla del mismo
`Code.exe`. `claude-sub` la borra del entorno del proceso, así que funciona sin cerrar VS Code
ni reiniciar Windows.

## Lo que se tocó en `~/.claude.json`

Se quitó la key de `customApiKeyResponses.approved` (Claude Code terminó borrando el objeto
completo al reescribir el archivo; el resto del config quedó intacto — 85 → 84 llaves, sólo
esa). Efecto: un `claude` pelón, arrancado en un entorno que todavía cargue la variable,
**pregunta** antes de usar la API en vez de facturar en silencio.

`rejected` se dejó **vacío a propósito**: meter la key ahí probablemente rompería
`claude-api`, que es justo el camino que se quiere conservar.
