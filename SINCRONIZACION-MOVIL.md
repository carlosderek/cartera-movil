# Sincronización con el móvil — formato del paquete

Contrato entre la app de escritorio (este proyecto, `src/mobile-sync.js`, desde la v12.77) y la app
del móvil (proyecto aparte). Si cambia algo de aquí, hay que cambiarlo en los dos lados y subir `schema`.

## Reglas

- **Un solo sentido:** escritorio → móvil. El móvil solo lee; nunca escribe en el gist.
- **Solo consulta:** el móvil no modifica posiciones, tesis ni liquidez.
- **Cifrado en el origen:** GitHub solo guarda el bloque cifrado. La contraseña la escribe el usuario
  en el escritorio y en el móvil; no viaja por ningún sitio.
- **Los precios no se sincronizan:** el móvil pide las cotizaciones por su cuenta. El paquete trae el
  último precio conocido por el escritorio solo para arrancar y para funcionar sin conexión.

## Dónde está

- Gist **secreto** de la cuenta de GitHub del usuario, con un único archivo: `cartera-movil.json`.
- El escritorio lo crea en la primera subida y enseña su identificador en «Sincronizar con el móvil».
- Lectura desde el móvil, sin credencial:
  `GET https://api.github.com/gists/<id>` → `files["cartera-movil.json"]`.
  Si `truncated` es `true` (más de ~1 MB), leer el contenido completo de `raw_url`.
  Sin credencial GitHub limita a 60 peticiones por hora y dirección IP: pedir el gist al abrir la app
  y al refrescar a mano, no en bucle.
- El móvil necesita dos datos del usuario: el **identificador del gist** y la **contraseña de cifrado**.

## Sobre cifrado (contenido del archivo)

```json
{
  "v": 1,
  "app": "cartera-movil",
  "alg": "AES-GCM-256",
  "kdf": "PBKDF2-SHA256",
  "iter": 310000,
  "salt": "<base64, 16 bytes>",
  "iv": "<base64, 12 bytes>",
  "ct": "<base64: texto cifrado + etiqueta GCM de 16 bytes al final>",
  "at": "2026-11-22T10:30:00.000Z"
}
```

Para descifrar (WebCrypto):

1. `clave = PBKDF2(contraseña en UTF-8, salt, iter, SHA-256) → AES-GCM de 256 bits`.
2. `texto = AES-GCM.decrypt({ iv }, clave, ct)`; el resultado es JSON en UTF-8.
3. Si la contraseña es incorrecta, `decrypt` lanza un error: mostrar «contraseña incorrecta», no un fallo genérico.

`salt` e `iv` cambian en cada subida. `iter` hay que leerlo del sobre, no darlo por fijo.

## Paquete descifrado (`schema: 1`)

Importes en euros salvo que se diga otra cosa. Porcentajes como fracción (0,05 = 5 %). `null` = sin dato.

```
{
  schema: 1, app: "cartera-movil", appVersion: "12.77",
  generatedAt: ISO,          // cuándo lo generó el escritorio: enseñarlo siempre
  clone: false,              // true si viene del clon de pruebas: avisar bien visible
  totals: { value, invested, pl, dayPl, dayPct, cash, grand },   // a fecha de generatedAt
  positions: [ {
    id, t (ticker), n (nombre), ty ("Acción" | "Cripto" | "Fondo"),
    cur (moneda de cotización; "GBX" o "GBp" = peniques), fx (EUR por unidad de cur, a generatedAt),
    sh (títulos), px (último precio en cur), chg (variación del día),
    buy (precio medio de compra en cur), inv (coste en EUR), val, pl, plPct,
    w (peso sobre la cartera sin liquidez), ctry, sec, lo / hi (mínimo y máximo de 52 semanas en cur),
    strat (estrategia DRACO, texto),
    q: { y (símbolo de Yahoo), cg (id de CoinGecko, solo cripto), ex (bolsa), isin },
    th: {
      conv (1–5), health (nota de salud 0–100), verdict (texto), status,
      cur (moneda de los escenarios),
      sc: { bear?, conservative?, base?, bull? → { p (precio), pr (probabilidad), d (fecha) } },
      text (tesis, recortada), cat (catalizadores), risks,
      sell: [ { t (texto), l (nivel), x (true = ya tocado) } ],
      ev:   [ { d (fecha), k (tipo), t (nota), ok (fecha confirmada) } ],   // solo futuras, máximo 6
      nextE (próximos resultados), review (fecha de revisión), updated,
      avisos: [ { s ("high" | "med"), t (título), d (detalle) } ]           // solo negativos, máximo 6
    }
  } ],                       // ordenadas por valor, de mayor a menor
  cash:  [ { n (cuenta), a (saldo) } ],
  ideas: [ { t, n, cur, px, chg, trg (precio de disparo), dir, conv, base (objetivo base), q: { y } } ],  // solo activas
  cycle: { phase (1–6), lbl, R (Rotation Score), next, nextLbl, p (probabilidad de cambio), week, prov,
           fga: { lbl, watch, date, stale } } | null
}
```

## Qué calcula el móvil y qué no

- **Calcula** con los precios que descarga: valor de cada posición (`sh × precio × tipo de cambio`),
  variación del día, ganancia frente a `inv`, pesos y patrimonio (posiciones + `totals.cash`).
- **No recalcula:** nota de salud, avisos, escenarios ni fase del ciclo. Son del escritorio y valen a
  fecha de `generatedAt`. Si han pasado varios días, decirlo.
- **Tipo de cambio:** `fx` es el del escritorio en el momento de generar. Para valorar al momento hay
  que pedir el cambio actual; si no se puede, usar `fx` y avisar.

## Fuentes de precios que usa el escritorio (para repetirlas en el móvil)

- Acciones de EE. UU.: Twelve Data, tiempo real, con clave propia del usuario.
- Resto de bolsas: Yahoo, con unos 15 minutos de retraso, a través de un intermediario (Yahoo no admite
  peticiones directas desde un navegador).
- Cripto: CoinGecko, por `q.cg`.
- Fondos: valor liquidativo diario; no tienen cotización intradía.

La clave de Twelve Data **no** va en el paquete: el móvil pide la suya en sus ajustes.

## Lo que el paquete no lleva

Operaciones, dividendos, histórico de patrimonio, posiciones cerradas, KPIs y guías de las tesis,
tesis completas (solo un recorte), lecturas FGA, datos de FRED, claves de fuentes de datos ni la
credencial de GitHub.
