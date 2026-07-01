/**
 * MEISTIA — Servidor puente para el chat
 * -------------------------------------------------
 * Guarda tu clave de API de Anthropic en el servidor (nunca en el navegador)
 * y hace de intermediario entre MEISTIA y la API de Claude.
 *
 * El frontend llama a  POST /api/chat  con { system, messages }
 * y este servidor reenvía la petición a la API de Anthropic con tu clave.
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Seguridad CORS: solo tus dominios pueden usar este backend ---
const DOMINIOS_PERMITIDOS = [
  "https://suelosmeister.com",
  "https://www.suelosmeister.com",
  "https://suelia.com",
  "https://www.suelia.com",
  "https://catalogo.suelosmeister.com",
];
app.use(
  cors({
    origin: function (origin, callback) {
      // permitir peticiones sin origin (p.ej. pruebas locales) y los dominios de la lista
      if (!origin || DOMINIOS_PERMITIDOS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origen no permitido por CORS"));
      }
    },
  })
);

// --- Clave de API: se lee de una variable de entorno, NUNCA se escribe aquí ---
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ERROR: falta la variable de entorno ANTHROPIC_API_KEY");
  process.exit(1);
}

const MODELO = "claude-sonnet-4-6";

// --- Endpoint del chat ---
app.post("/api/chat", async (req, res) => {
  try {
    const { system, messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages debe ser un array" });
    }

    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 1000,
        system: system || "",
        messages: messages,
      }),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      console.error("Error de la API de Anthropic:", datos);
      return res.status(respuesta.status).json({ error: "Error de la API", detalle: datos });
    }

    // Devolvemos solo el texto de la respuesta
    const texto = (datos.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    res.json({ reply: texto });
  } catch (err) {
    console.error("Error en /api/chat:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// --- Comprobación de salud (para verificar que el servidor vive) ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", servicio: "MEISTIA backend", modelo: MODELO });
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`MEISTIA backend escuchando en el puerto ${PUERTO}`);
});
