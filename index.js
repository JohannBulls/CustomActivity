// index.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variables de entorno (¡NUNCA las pongas directamente en el código!)
// Las configuraremos en Heroku más tarde.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SFMC_JWT_SECRET = process.env.SFMC_JWT_SECRET;

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

/**
 * Endpoint /execute
 * Aquí es donde la magia sucede. Journey Builder llama a este endpoint para cada contacto.
 */
app.post('/execute', (req, res) => {
    // Verifica que la petición viene de Salesforce Marketing Cloud
    jwt.verify(req.body, SFMC_JWT_SECRET, { algorithm: 'HS256' }, async (err, decoded) => {
        if (err) {
            console.error('Error de JWT:', err);
            return res.status(401).send('No autorizado');
        }

        console.log('Payload decodificado:', decoded);

        // Extrae los datos del contacto que vienen del Journey
        const inArguments = decoded.inArguments || [];
        const contactData = {};
        inArguments.forEach(arg => {
            // El formato es {{Contact.Attribute.DataExtension.Field}}
            // Lo simplificamos a solo el nombre del campo.
            const key = Object.keys(arg)[0];
            contactData[key] = arg[key];
        });
        
        const contactKey = decoded.keyValue;
        console.log(`Ejecutando para ContactKey: ${contactKey} con datos:`, contactData);

        // --- CONSTRUCCIÓN DEL PROMPT PARA GEMINI ---
        const prompt = `
            Eres un experto en marketing por email. Tu tarea es escribir un borrador de correo electrónico altamente personalizado.
            
            Información del Cliente:
            - Nombre: ${contactData.FirstName || 'valioso cliente'}
            - Apellido: ${contactData.LastName || ''}
            - Email: ${contactData.EmailAddress}
            - Último producto comprado: ${contactData.LastPurchase || 'uno de nuestros excelentes productos'}

            Instrucciones:
            1. Escribe un correo electrónico completo, incluyendo un asunto atractivo y un cuerpo de mensaje.
            2. El tono debe ser amigable, cercano y servicial, no agresivo.
            3. Menciona su última compra para mostrar que lo conocemos.
            4. Sugiérele un producto complementario o una categoría que le pueda interesar.
            5. Finaliza con un llamado a la acción claro, como visitar una página web o usar un código de descuento.
            6. NO incluyas placeholders como "[Nombre de la empresa]". Sé creativo.
            7. Responde únicamente con el correo en formato JSON, con las claves "asunto" y "cuerpo". Ejemplo: {"asunto": "Tu próximo descubrimiento te espera", "cuerpo": "Hola..."}
        `;

        try {
            console.log('Enviando prompt a Gemini...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log('Respuesta de Gemini:', text);
            
            // Aquí deberías añadir la lógica para guardar 'text' en tu Data Extension
            // usando la API REST de SFMC. Por simplicidad, aquí solo lo mostramos.
            // Para un caso real, necesitarías una llamada a la API de SFMC aquí.
            console.log(`TAREA PENDIENTE: Guardar el correo para el ContactKey ${contactKey} en la Data Extension.`);

            // Devolvemos 200 OK para que el journey continúe
            res.status(200).send('Ejecución completada.');

        } catch (error) {
            console.error('Error al llamar a la API de Gemini:', error);
            res.status(500).send('Error en la ejecución.');
        }
    });
});

/**
 * Endpoints /save, /publish, /validate
 * Estos son requeridos por Journey Builder para configurar la actividad.
 */
app.post('/save', (req, res) => {
    console.log('Guardando actividad...');
    res.status(200).json({ success: true });
});

app.post('/publish', (req, res) => {
    console.log('Publicando actividad...');
    res.status(200).json({ success: true });
});

app.post('/validate', (req, res) => {
    console.log('Validando actividad...');
    res.status(200).json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});