# Cartera móvil

App web instalable (PWA) para consultar en Android la cartera de la app de escritorio. Solo lee: descarga
la copia cifrada del gist secreto, la descifra en el móvil y pide las cotizaciones por su cuenta.
El formato del paquete está en [SINCRONIZACION-MOVIL.md](SINCRONIZACION-MOVIL.md).

Sin dependencias ni paso de compilación: HTML, CSS y módulos JavaScript.

## Pantallas

- **Resumen**: patrimonio (posiciones + liquidez), variación del día, ganancia, las tres que más suben y
  más bajan, línea de ciclo (fase 1–6, siguiente fase y probabilidad, lectura FGA) y liquidez por cuenta.
- **Posiciones**: lista con filtro por tipo y orden por valor, día %, día €, ganancia %, ganancia € o salud.
- **Ficha**: precio y fuente, posición, rango de 52 semanas con el precio de compra, escenarios con
  potencial y valor esperado, nota de salud y avisos, criterios de venta, próximas fechas, y tesis,
  catalizadores y riesgos plegables.
- **Avisos**: estado de los datos (clon, copia antigua, divisas, posiciones sin precio), criterios de venta
  tocados, avisos de las tesis, ideas en precio de compra o cerca, y fechas de los próximos 14 días.

## Precios

| Qué | Fuente | Notas |
|---|---|---|
| Acciones de EE. UU. | Twelve Data | Solo con tu clave (Ajustes). Plan gratuito: 8 símbolos/min. |
| Resto de bolsas | Yahoo vía `r.jina.ai` | ~15 min de retraso; como mucho 18 peticiones/min. |
| Cripto | CoinGecko, en EUR | |
| Fondos | quefondos.com por ISIN vía `r.jina.ai` | Valor liquidativo diario, sin variación del día. |
| Divisas | BCE (Frankfurter) | Si falla, el cambio del paquete y un aviso. |

Lo que no tiene cotización se valora con el último precio del escritorio y se marca con «•».
Los precios se piden al abrir, al tocar ↻ y cada 5 minutos con la app en pantalla. El gist solo se pide al
abrir y al refrescar a mano (como mucho una vez por minuto).

## Qué se guarda en el móvil

- El identificador del gist, la clave de Twelve Data y el intermediario.
- La última copia **cifrada** del gist, para abrir sin conexión.
- La contraseña, **solo** si marcas «Recordar». Se guarda sin cifrar en el almacenamiento de la app.
- Las cotizaciones y el paquete descifrado viven en memoria, nunca en disco.

«Ajustes → Olvidar todo» lo borra todo de este móvil.

## Publicarla (GitHub Pages)

La PWA necesita HTTPS. El código no lleva ningún secreto, así que puede ir en un repositorio público.

1. Crea un repositorio en GitHub (por ejemplo `cartera-movil`) y sube esta carpeta. La carpeta `tools/`
   y `.claude/` no hacen falta en la web, pero no molestan.
2. En el repositorio: *Settings → Pages → Build and deployment → Deploy from a branch*, rama `main`,
   carpeta `/ (root)`.
3. Abre en el móvil `https://<tu-usuario>.github.io/cartera-movil/` con Chrome.
4. Menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»).
5. Escribe el identificador del gist (el que enseña el escritorio en «Sincronizar con el móvil») y la
   contraseña de cifrado.

Si quitas la carpeta `demo/`, el identificador `demo` deja de funcionar; no afecta a nada más.

Al publicar una versión nueva, cambia `VERSION` en `sw.js`: la app enseñará «Hay una versión nueva».

## Probar en el ordenador

```powershell
node tools/serve.mjs 8080
```

Abre `http://localhost:8080`, usa el identificador `demo` y la contraseña que está en
`tools/make-demo.mjs` (`DEMO_PASS`). Son datos inventados; los precios sí son reales, así que los valores no
cuadran con los del paquete de ejemplo.

- `node tools/make-demo.mjs` regenera `demo/cartera-movil.json`.
- `node tools/make-icons.mjs` regenera los iconos PNG.
