require('dotenv').config()
const { createBot, createProvider, createFlow, addKeyword,EVENTS } = require('@bot-whatsapp/bot')
const Queue = require('queue-promise')
const mimeType = require('mime-types')
const fs = require('node:fs/promises');
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const JsonFileAdapter = require("@bot-whatsapp/database/json");
const ServerHttp = require('./src/http/http.class')
const ChatwootClass = require('./src/chatwoot/chatwoot.class')
const { handlerMessage } = require('./src/chatwoot')
const {convertOggMp3}= require('./src/util/convert.util');
const chalk = require('chalk');
const HandlerMessage = require('./src/chatwoot/handler.class');
const getDevice = require('./src/util/device.utils');
const {black} = require('./src/util/blacklist.class');

const PORT = process.env.PORT ?? 3001

const flowWelcome = addKeyword("#empezar").addAction(async (ctx,{flowDynamic,state}) => {
    const flag = 'first_message'
    const userState = state?.getMyState();
    if (!userState?.[flag]) {
        await state?.update(
            {
                [flag] : true
            }
        )
        return await flowDynamic('Bienvenido nuevo usuario');
    }
    return flowDynamic('Bienvenido de nuevo!!!');
})

const flowPrincipal = addKeyword('#asesor')
    .addAnswer('Buenas bienvenido a mi ecommerce')
    .addAnswer('¿Como puedo ayudarte el dia de hoy?')
    .addAction({capture:true},async (ctx, {extensions, provider, flowDynamic,endFlow}) => {
        const jid= ctx?.key?.remoteJid;
        console.log("Me escribes desde:",getDevice(ctx?.key?.id));
        const from= ctx?.from;
        const pushName = ctx?.pushName;
        const response=await provider.vendor.sendMessage(jid,{
            image: {url: `https://ik.imagekit.io/ljpa/Profiles/51966524537_30-12-2023_02-41-23.jpg`}, caption:`Hola ${pushName}!, un asesor se comunicara contigo`,
            mimetype: "image/jpeg",
        });
        await extensions.handler.sendMessageWoot(response, from, pushName); 
    });

const serverHttp = new ServerHttp(PORT)

const chatwoot = new ChatwootClass({
    account: process.env.CHATWOOT_ACCOUNT_ID,
    token: process.env.CHATWOOT_TOKEN,
    endpoint: process.env.CHATWOOT_ENDPOINT
})

const queue = new Queue({
    concurrent: 1,
    interval: 500
})

const main = async () => {
    const adapterDB = new JsonFileAdapter()
    const adapterFlow = createFlow([flowPrincipal,flowWelcome])
    const adapterProvider = createProvider(BaileysProvider,{ usePairingCode: process.env.USE_PAIRING_CODE, phoneNumber: process.env.PHONE_NUMBER})

    const config ={
        extensions: {
            handler:new HandlerMessage(PORT,chatwoot),
            blacklist: black
        },
        blackList: black.getBlackList()
    }
    const bot = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    },config)

    serverHttp.initialization(bot)

     // 2° opcion !payload?.message.extendedTextMessage.text
     // ESTO ESCUCHA LOS EVENTOS DE MENSAJES ENTRANTES (CUANDO EL CLIENTE ENVIA UN MENSAJE ---> )
    adapterProvider.on('message', (payload) => {
        queue.enqueue(async () => {
            try {
                const captionFile = payload?.message?.imageMessage?.caption ?? payload?.message?.videoMessage?.caption ?? payload?.message?.documentMessage?.caption ?? payload?.message?.audioMessage?.caption ?? '';
                const attachment = []
               
                if (payload?.body.includes('_event_')) {
                    const mime = payload?.message?.imageMessage?.mimetype ?? payload?.message?.videoMessage?.mimetype ?? payload?.message?.documentMessage?.mimetype ?? payload?.message?.audioMessage?.mimetype;
                    const extension = mimeType.extension(mime);
            
                    const buffer = await downloadMediaMessage(payload, "buffer");
                    const fileName = `file-${Date.now()}.${extension}`;
                    const pathFile = `${process.cwd()}/public/${fileName}`;
                    await fs.writeFile(pathFile, buffer);
                    if(extension === 'oga'){
                        // todo convirtiendo audio oga en mp3 y guardandolo
                        await convertOggMp3(pathFile,pathFile.replace('.oga','.mp3'));
                        //todo eliminando el archivo oga
                        await fs.unlink(pathFile);
                    }
                    console.log(chalk.green.bold(`[FICHERO ENVIADO CLIENTE WA CREADO]`),chalk.cyan(`📋 http://localhost:${PORT}/${fileName.replace('.oga','.mp3')}`));
                    attachment.push(pathFile.replace('.oga','.mp3'))
                }

                console.log(chalk.green.bold(`>>>>[MENSAJE ENVIADO DESDE WA]`),chalk.cyan(`📋 ${payload.body}`));
                await handlerMessage({
                    phone: payload.from,
                    name: payload.pushName,
                    message: captionFile ? captionFile : payload.body,
                    attachment,
                    mode: 'incoming'
                }, chatwoot)
            } catch (err) {
                console.log('ERROR', err)
            }
        });
    });

    /**
     * Los mensajes salientes (cuando usas el bot (andAnswer) le envia un mensaje al cliente ---> )
     * ESTE EMITE EL EVENTO SEND_MESSAGE Y LO CAPTURAMOS AQUI , QUE SERA EMITIDO POR DEBAJO .emit
     */
    bot.on('send_message', (payload) => {
        queue.enqueue(async () => {
            console.log(chalk.green.bold(`<<<<[MENSAJE ENVIADO DESDE EL BOT CODIGO EN CASA]`),chalk.cyan(`📋 ${payload.answer}`));
            await handlerMessage({
                phone: payload.numberOrId,
                name: payload.pushName,
                message: payload.answer,
                mode: 'outgoing'
            }, chatwoot)
        })
    })
}

main()
