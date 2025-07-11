// =================================================================
// Estructura del bot
// =================================================================

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const pino = require('pino');

// Crear un logger que descarte todos los mensajes.
const logger = pino({ level: 'silent' });

// =================================================================
// SECCIÓN DE FUNCIONES DE UTILIDAD Y LÓGICA
// =================================================================

/**
 * Busca el JID de un grupo a partir de su nombre.
 * @param {Socket} sock - El socket de Baileys activo.
 * @param {string} nombreGrupo - El nombre exacto del grupo a buscar.
 * @returns {Promise<string|null>} - El JID del grupo o null si no se encuentra.
 */
async function obtenerJidGrupoPorNombre(sock, nombreGrupo) {
    try {
        const grupos = await sock.groupFetchAllParticipating();
        for (const jid in grupos) {
            if (grupos[jid].subject === nombreGrupo) {
                return jid;
            }
        }
        return null; // No se encontró el grupo
    } catch (error) {
        console.error("Error al buscar el JID del grupo por nombre:", error);
        return null;
    }
}


/**
 * Analiza un mensaje de grupo y envía una notificación a un destino específico.
 * @param {Socket} sock - El socket de Baileys activo.
 * @param {object} m - El objeto de mensaje crudo de Baileys.
 * @param {string} destino - El destino de la notificación (un número de teléfono o el nombre de un grupo).
 */
async function analizarMensajeDeGrupo(sock, m, destino) {
    let texto = '';
    const messageType = Object.keys(m.message)[0];
    const messageContent = m.message[messageType];
    
    if (messageType === 'conversation') texto = messageContent;
    else if (messageType === 'extendedTextMessage') texto = messageContent.text;
    else if (messageContent && messageContent.caption) texto = messageContent.caption;

    if (!texto || typeof texto !== 'string') return;
    
    const textoLower = texto.toLowerCase();

    // *** LÓGICA DE DETECCIÓN POR PATRONES (VERSIÓN MEJORADA) ***

    // 1. Definir listas de palabras estratégicas
    const serviceKeywords = ['netflix', 'neflix', 'neflis', 'amazon', 'prime', 'disney', 'hbo', 'spotify', 'apple tv', 'youtube premium', 'paramount', 'star+'];
    const strongOfferingKeywords = ['vendo', 'ofrezco', 'tengo', 'precios', 'promoción', 'información al dm', 'disponibles combos'];
    const seekingKeywords = ['busco', 'compro', 'necesito', 'buscando', 'ando buscando'];
    const questionKeywords = ['quien', 'quién', 'alguien', 'saben si', 'sabe alguien', 'hay'];
    const actionKeywords = ['vende', 'tiene', 'alquila', 'consigue', 'maneja', 'disponible', 'a la venta'];

    // 2. Verificar que se mencione un servicio. Si no, no es relevante.
    const servicioMencionado = serviceKeywords.find(keyword => textoLower.includes(keyword));
    if (!servicioMencionado) return;

    // 3. Descartar inmediatamente si es una oferta clara de un vendedor.
    const isStrongOffer = strongOfferingKeywords.some(keyword => textoLower.includes(keyword));
    if (isStrongOffer) return;

    // 4. Verificar si el mensaje coincide con un patrón de compra.
    const isDirectSeeking = seekingKeywords.some(keyword => textoLower.includes(keyword));
    const isQuestionAboutAction = questionKeywords.some(qWord => textoLower.includes(qWord)) && actionKeywords.some(aWord => textoLower.includes(aWord));
    
    // Si es una búsqueda directa O una pregunta sobre una acción, es un posible cliente.
    if (isDirectSeeking || isQuestionAboutAction) {
        try {
            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
            const groupName = groupMetadata.subject;
            const senderName = m.pushName;
            const senderNumber = m.key.participant.split('@')[0];
            
            const mensajeNotificacion = `🎯 ¡Posible Cliente Detectado!
            
*Grupo:* ${groupName}
*Usuario:* ${senderName}
*Num:* +${senderNumber}
*Busca:* ${servicioMencionado.charAt(0).toUpperCase() + servicioMencionado.slice(1)}

*Mensaje Original:*
_"${texto}"_`;

            const content = { tipo: 'texto', data: { texto: mensajeNotificacion } };

            if (/^\d+$/.test(destino.replace('+', ''))) {
                const numeroJid = `${destino.replace(/\D/g, '')}@s.whatsapp.net`;
                await enviarMensajePrivado(sock, numeroJid, content);
            } else {
                const grupoJid = await obtenerJidGrupoPorNombre(sock, destino);
                if (grupoJid) {
                    await enviarMensajeGrupo(sock, grupoJid, content);
                } else {
                    console.error(`Error: No se pudo encontrar el grupo de notificación llamado "${destino}".`);
                }
            }           
        } catch (error) {
            console.error('Error al procesar la notificación de grupo:', error);
        }
    }
}

/**
 * Traduce un mensaje entrante de Baileys a nuestro formato de contenido estándar.
 * Se encarga de la lógica de descarga de multimedia.
 * @param {object} m - El objeto de mensaje crudo de Baileys.
 * @returns {Promise<object|null>} - Un objeto de contenido listo para enviar, o null si el tipo no es soportado.
 */
async function traducirMensajeEntrante(m) {
    if (!m.message) return null;
    const messageType = Object.keys(m.message)[0];
    const messageContent = m.message[messageType];
    let contentParaEnviar = { tipo: '', data: {} };
    try {
        switch (messageType) {
            case 'conversation': contentParaEnviar = { tipo: 'texto', data: { texto: messageContent } }; break;
            case 'extendedTextMessage': contentParaEnviar = { tipo: 'texto', data: { texto: messageContent.text } }; break;
            case 'imageMessage': contentParaEnviar = { tipo: 'imagen', data: { buffer: await downloadMediaMessage(m, 'buffer', {}, { logger }), caption: messageContent.caption }}; break;
            case 'videoMessage': contentParaEnviar = { tipo: 'video', data: { buffer: await downloadMediaMessage(m, 'buffer', {}, { logger }), caption: messageContent.caption, ptt: messageContent.ptt }}; break;
            case 'audioMessage': contentParaEnviar = { tipo: 'audio', data: { buffer: await downloadMediaMessage(m, 'buffer', {}, { logger }), ptt: messageContent.ptt }}; break;
            case 'stickerMessage': contentParaEnviar = { tipo: 'sticker', data: { buffer: await downloadMediaMessage(m, 'buffer', {}, { logger }) }}; break;
            case 'documentMessage': contentParaEnviar = { tipo: 'documento', data: { buffer: await downloadMediaMessage(m, 'buffer', {}, { logger }), mimetype: messageContent.mimetype, fileName: messageContent.fileName }}; break;
            default: return null;
        }
        return contentParaEnviar;
    } catch (error) {
        console.error(`Error al traducir/descargar el mensaje tipo ${messageType}:`, error);
        return null;
    }
}


// =================================================================
// SECCIÓN DE FUNCIONES DE ENVÍO MODULARES
// =================================================================

/**
 * Prepara y envía un mensaje a un JID específico.
 */
async function enviarContenido(sock, jid, content) {
    try {
        let messageObject = {};
        const data = content.data || {};
        let buffer = data.buffer;

        if (!buffer && data.ruta) {
            if (fs.existsSync(data.ruta)) buffer = fs.readFileSync(data.ruta);
            else {
                console.error(`Error: No se encontró el archivo en la ruta: ${data.ruta}`);
                return;
            }
        }

        switch (content.tipo) {
            case 'texto': messageObject = { text: data.texto || '' }; break;
            case 'imagen': messageObject = { image: buffer, caption: data.caption || '' }; break;
            case 'video': messageObject = { video: buffer, caption: data.caption || '', ptt: !!data.ptt }; break;
            case 'audio': messageObject = { audio: buffer, mimetype: 'audio/mp4', ptt: !!data.ptt }; break;
            case 'sticker': messageObject = { sticker: buffer }; break;
            case 'documento': messageObject = { document: buffer, mimetype: data.mimetype, fileName: data.fileName }; break;
            default:
                console.error(`Error: Tipo de contenido desconocido para enviar: "${content.tipo}"`);
                return;
        }
        await sock.sendMessage(jid, messageObject);
    } catch (error) {
        console.error(`Error al enviar contenido a ${jid}:`, error);
    }
}

/**
 * Envía un mensaje a un chat privado.
 */
async function enviarMensajePrivado(sock, jid, content) {
    if (!jid || jid.endsWith('@g.us')) {
        console.error(`Error: JID inválido para mensaje privado: ${jid}`);
        return;
    }
    await enviarContenido(sock, jid, content);
}

/**
 * Envía un mensaje a un grupo.
 */
async function enviarMensajeGrupo(sock, jid, content) {
    if (!jid || !jid.endsWith('@g.us')) {
        console.error(`Error: JID inválido para mensaje de grupo: ${jid}`);
        return;
    }
    await enviarContenido(sock, jid, content);
}


// =================================================================
// SECCIÓN DE CONEXIÓN Y LÓGICA PRINCIPAL DEL BOT
// =================================================================

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 20000,
        retryRequestDelayMs: 100,
        maxRetries: 3,
        browser: ['Chrome (Linux)', 'Chrome', '119.0.6045.124'],
        logger: logger,
        printQRInConsole: false,
        markOnlineOnConnect: false,
        syncFullHistory: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log('\n⚠️ ===========================================');
                console.log('⚠️ LA SESIÓN HA SIDO CERRADA DESDE WHATSAPP');
                console.log('⚠️ Por favor, escanea el nuevo código QR');
                console.log('⚠️ ===========================================\n');

                // Eliminar las credenciales guardadas
                try {
                    await fs.rmSync('auth_info', { recursive: true, force: true });
                    console.log('✅ Credenciales anteriores eliminadas correctamente');
                } catch (error) {
                    console.log('No se encontraron credenciales anteriores');
                }
            } else {
                console.log('\n⚠️ Conexión cerrada. Reconectando...');
            }

            if (shouldReconnect) {
                setTimeout(iniciarBot, 1000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ ===========================================');
            console.log('✅ Conexión establecida exitosamente!');
            console.log('✅ ===========================================\n');
            try {
                await saveCreds();
                console.log('✅ Credenciales guardadas correctamente');
            } catch (error) {
                console.error('❌ Error al guardar credenciales:', error.message);
            }

            // Obtener información del usuario
            const user = sock.user;
            console.log('Usuario conectado:', user.id);
        }
    });

    sock.ev.on('creds.update', async () => { await saveCreds(); });

    //================================================
    // MANEJO DE MENSAJES ENTRANTES (LÓGICA LIMPIA)
    //================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const sender = m.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');

        if (isGroup) {
            // Si el mensaje es de un grupo, lo pasamos a nuestra función de análisis.
            await analizarMensajeDeGrupo(sock, m, 'Clientes Streaming 💸');
        } else {
            // Lógica de eco solo para el número específico y chats privados
            if (sender.includes('3144923892')) {
                // 1. Traducir el mensaje a nuestro formato estándar
                const contentParaEnviar = await traducirMensajeEntrante(m);
                // 2. Si la traducción fue exitosa, enviar usando la función modular
                if (contentParaEnviar) {
                    await enviarMensajePrivado(sock, sender, contentParaEnviar);
                    console.log(`Eco del mensaje tipo "${contentParaEnviar.tipo}" enviado a ${sender}`);
                }
            }
        }
    });

    return sock;
}

// Asegurarse de que WhatsApp esté conectado
async function estaConectado() {
    return !!globalSock;
}

// =================================================================
// PUNTO DE ENTRADA
// =================================================================
iniciarBot();

module.exports = {
    iniciarBot,
    estaConectado
};

process.on('uncaughtException', (err) => console.error('Error no capturado:', err));
process.on('unhandledRejection', (reason) => console.error('Promesa rechazada no manejada:', reason));