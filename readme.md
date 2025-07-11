# 🎯 Bot Rastreador de Clientes para WhatsApp

Este es un bot de WhatsApp potente y eficiente, desarrollado en **Node.js** utilizando la librería **@whiskeysockets/baileys**. Su objetivo principal es automatizar la captación de leads (clientes potenciales) mediante el monitoreo de grupos de WhatsApp y la identificación de usuarios que expresan interés en adquirir servicios de streaming.

## ✨ Características Principales

-   **Detección Inteligente de Clientes**: Analiza los mensajes de los grupos para identificar patrones de compra. Descarta automáticamente los mensajes de otros vendedores para centrarse únicamente en compradores potenciales.
-   **Notificaciones Instantáneas**: Al detectar un posible cliente, envía una notificación bien formateada a un número o grupo privado que tú elijas. La notificación incluye:
    -   Nombre del grupo de origen.
    -   Nombre y número del usuario interesado.
    -   El servicio específico que busca.
    -   El mensaje original para dar contexto.
-   **Manejo de Sesión Robusto**: Gestiona la conexión de forma automática, mostrando un código QR en la terminal para iniciar sesión y reconectándose si la conexión se pierde. También maneja el cierre de sesión, eliminando las credenciales antiguas para un nuevo escaneo.
-   **Arquitectura Modular**: El código está organizado en secciones claras (utilidades, envío de mensajes, lógica principal), lo que facilita su mantenimiento y la adición de nuevas funcionalidades.
-   **Soporte Multimedia**: Incluye funciones para manejar y reenviar diversos tipos de mensajes, como texto, imágenes, videos, audios, stickers y documentos.

## 🚀 ¿Cómo Funciona?

El corazón del bot es la función `analizarMensajeDeGrupo`. Su lógica es la siguiente:

1.  **Escucha de Mensajes**: El bot está atento a todos los mensajes en los grupos en los que participa.
2.  **Filtro por Servicio**: Primero, verifica si el mensaje contiene palabras clave de servicios de streaming (ej. `netflix`, `spotify`, `disney`, etc.). Si no, lo ignora.
3.  **Descarte de Vendedores**: A continuación, busca palabras clave asociadas a ofertas (`vendo`, `ofrezco`, `tengo disponibles`). Si encuentra alguna, ignora el mensaje para evitar notificar sobre la competencia.
4.  **Identificación de Compradores**: Finalmente, busca patrones que indiquen una intención de compra, como:
    -   Búsqueda directa: (`busco`, `compro`, `necesito`).
    -   Preguntas sobre disponibilidad: (`¿alguien vende?`, `¿quién tiene?`).
5.  **Envío de Notificación**: Si se cumplen las condiciones, formatea y envía la alerta de "Posible Cliente Detectado" al destino configurado.

## 🔧 Configuración e Instalación

Sigue estos pasos para poner en marcha tu bot.

### Prerrequisitos

-   [Node.js](https://nodejs.org/) (versión 16 o superior recomendada).
-   `npm` o `yarn` para la gestión de paquetes.

### Pasos

1.  **Clona el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/tu-repositorio.git](https://github.com/tu-usuario/tu-repositorio.git)
    cd tu-repositorio
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Configura el bot:**
    Abre el archivo principal (`index.js` o como lo hayas llamado) y modifica las siguientes líneas según tus necesidades:

    -   **Destino de las notificaciones**: Cambia `'Clientes Streaming 💸'` por el nombre exacto del grupo o el número de teléfono (en formato internacional, ej: `573001234567`) donde quieres recibir las alertas.

        ```javascript
        // Ubica esta línea dentro del evento 'messages.upsert'
        await analizarMensajeDeGrupo(sock, m, 'AQUÍ_VA_TU_GRUPO_O_NUMERO');
        ```

    -   **(Opcional) Lógica de eco para pruebas**: El bot tiene una función de eco que responde a un número específico. Modifícalo o elimínalo si no lo necesitas.

        ```javascript
        // Cambia o elimina este bloque
        if (sender.includes('3144923892')) {
            // ... lógica de eco
        }
        ```

    -   **(Opcional) Personaliza las palabras clave**: Puedes editar las listas de palabras clave (`serviceKeywords`, `seekingKeywords`, etc.) en la función `analizarMensajeDeGrupo` para adaptar el bot a otros nichos o mejorar la precisión.

## ▶️ Uso

1.  **Inicia el bot** desde tu terminal:
    ```bash
    node index.js
    ```

2.  **Escanea el Código QR**: La primera vez que lo ejecutes, aparecerá un código QR en la terminal. Escanéalo con tu teléfono desde la aplicación de WhatsApp (`Configuración > Dispositivos vinculados > Vincular un dispositivo`).

3.  **¡Listo!** Una vez que la conexión sea exitosa, el bot comenzará a monitorear los grupos y a enviarte notificaciones. La sesión se guardará en la carpeta `auth_info` para no tener que escanear el QR cada vez.

## 📦 Dependencias Principales

-   [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys): La librería principal para interactuar con la API no oficial de WhatsApp.
-   [`qrcode-terminal`](https://github.com/gtanner/qrcode-terminal): Para generar el código QR de inicio de sesión en la consola.
-   [`pino`](https://github.com/pinojs/pino): Un logger de alto rendimiento (utilizado aquí en modo silencioso para evitar el spam en la consola).

## 📄 Licencia

Este proyecto es de código abierto. Siéntete libre de usarlo, modificarlo y distribuirlo.

---

_Desarrollado con ❤️ para optimizar tus ventas._