# Cartera móvil

App web instalable (PWA) para consultar en Android la cartera de la app de escritorio. Solo lee: descarga
la copia cifrada del gist secreto, la descifra en el móvil y pide las cotizaciones por su cuenta.
El formato del paquete está en [SINCRONIZACION-MOVIL.md](SINCRONIZACION-MOVIL.md).

Sin dependencias ni paso de compilación: HTML, CSS y módulos JavaScript.

## Pantallas

- **Resumen**: patrimonio (posiciones + liquidez), variación del día y la del índice compuesto, ganancia,
  evolución del patrimonio (1 mes a todo), tu cartera frente al índice compuesto (día y periodo), línea de
  resumen de tus tesis (salud media, potencial al base, reparto por nota), ciclo, las que más suben y bajan, distribución por tipo, sector, país o moneda, y liquidez por cuenta.
- **Posiciones**: buscador, filtro por tipo y orden por valor, día, ganancia, potencial al escenario base,
  precio frente a tu compra o salud.
- **Ficha**: precio y fuente, posición, rango de 52 semanas con el precio de compra, cotización de un año
  con tu compra y el objetivo base marcados, escenarios con
  potencial y valor esperado, nota de salud y avisos, criterios de venta, próximas fechas, y tesis,
  catalizadores y riesgos plegables.
- **Ideas**: las ideas activas ordenadas por cercanía al precio de disparo, con su potencial.
- **Avisos**: estado de los datos (clon, copia antigua, divisas, posiciones sin precio), criterios de venta
  tocados, avisos de las tesis, ideas en precio de compra o cerca, y fechas de los próximos 14 días.

Además: el ojo de la cabecera oculta importes (y en Ajustes, «Abrir siempre con los importes ocultos»),
deslizar hacia abajo en lo alto de la pantalla refresca, y la app se puede abrir con la huella.

Las gráficas y el índice compuesto necesitan el escritorio v12.78 o posterior (paquete `schema: 2`).
Con un paquete `schema: 1` esas tarjetas no salen y el resto funciona igual.

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
- La contraseña, **solo** si marcas «Recordar» (sin cifrar) o si activas la huella (cifrada con una llave
  de acceso del móvil; sin tu huella o tu bloqueo de pantalla no se puede leer).
- Las cotizaciones y el paquete descifrado viven en memoria, nunca en disco.

«Ajustes → Olvidar todo» lo borra todo de este móvil.

## Intermediario propio (opcional, recomendado)

`r.jina.ai` admite 20 peticiones por minuto por conexión, compartidas con el escritorio si estáis en la
misma red. `worker/proxy.js` es un intermediario propio para Cloudflare Workers (plan gratuito: 100.000
peticiones al día) que solo deja pasar Yahoo, quefondos y CoinGecko y solo responde a esta app.

1. Crea una cuenta gratuita en cloudflare.com.
2. *Workers & Pages → Create → Create Worker*, ponle un nombre (por ejemplo `cartera-proxy`) y *Deploy*.
3. *Edit code*, sustituye todo por el contenido de `worker/proxy.js` y *Deploy*.
4. En la app del móvil, *Ajustes → Intermediario*:
   `https://cartera-proxy.<tu-subdominio>.workers.dev/?url={urlenc}`

Si publicas la app en otra dirección, añádela a `ORIGINS` en `worker/proxy.js`.

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
