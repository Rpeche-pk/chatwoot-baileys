const express = require('express')
const cors = require('cors')
const {join} = require('path')
const {createReadStream} = require('fs')
const {wait, getRandomDelay,typingTime} = require('../util/delay.util');
const chalk = require('chalk');

/**
 * Esta clase esta relacionada con todo lo que tiene que ver
 * con un endpoint o rutas de express para tener un punto de entrada
 * externo y flexible
 */
class ServerHttp {
    app;
    port;

    constructor(_port = 4000){
        this.port = _port
    }

    /**
     * este es el controlador para mostar el qr code
     * @param {*} _ 
     * @param {*} res 
     */
    qrCtrl = (_, res) => {
        const pathQrImage = join(process.cwd(), `bot.qr.png`);
        const fileStream = createReadStream(pathQrImage);
        res.writeHead(200, { "Content-Type": "image/png" });
        fileStream.pipe(res);
    }

    /**
     * Este el controlador del los enventos del Chatwoot
     * @param {*} req 
     * @param {*} res 
     */
    chatwootCtrl = async (req, res) => {
        const body = req.body;
        const attachments = body?.attachments
        const bot = req.bot;
        try {
            //console.log(JSON.stringify(body));

            const mapperAttributes = body?.changed_attributes?.map((a) => Object.keys(a)).flat(2); //[ 'assignee_id', 'updated_at' ]
            

            /**
             * Esta funcion se encarga de agregar o remover el numero a la blacklist
             * eso quiere decir que podemos hacer que el chatbot responda o no
             * para que nos sirve, para evitar que el chatbot responda mientras
             * un agente humano esta escribiendo desde chatwoot
             */
            if (body?.event === 'conversation_updated' && mapperAttributes.includes('assignee_id')) {
                const phone = body?.meta?.sender?.phone_number.replace('+', '')
                const idAssigned = body?.changed_attributes[0]?.assignee_id?.current_value ?? null
                console.log(chalk.bgCyan(`[BLACKLIST]`), chalk.green.bold(`${phone} - asesor ${idAssigned ?? 'sin asignar'}`));
                if(idAssigned){
                    console.log(chalk.bgCyan(`[BLACKLIST] ADD`), chalk.green.bold(`${phone}`));
                    bot.dynamicBlacklist.add(phone)
                }else{
                    console.log(chalk.bgCyan(`[BLACKLIST] REMOVE`), chalk.green.bold(`${phone}`));
                    bot.dynamicBlacklist.remove(phone)
                }
                res.send('ok')
                return
            }

            /*if(body?.event === 'contact_updated' && body?.custom_attributes?.bot){
                if (body?.custom_attributes?.bot === 'on') {
                    console.log(`[BLACKLIST] numero ${body?.phone_number.replace('+', '')} removido de la blacklist`);
                    bot.dynamicBlacklist.remove(body?.phone_number.replace('+', ''));
                }else{
                    console.log(`[BLACKLIST] numero ${body?.phone_number.replace('+', '')} agregado a la blacklist`);
                    bot.dynamicBlacklist.add(body?.phone_number.replace('+', ''));
                }
                res.send('ok')
                return;
            }*/


            /**
             * La parte que se encarga de determinar si un mensaje es enviado al whatsapp del cliente
             */
            const checkIfMessage = body?.private == false && body?.event == "message_created" && body?.message_type === "outgoing" && body?.conversation?.channel.includes("Channel::Api")
            if (checkIfMessage) {
                const phone = body.conversation?.meta?.sender?.phone_number.replace('+', '')
                const content = body?.content ?? '';
                const jid = `${phone}@s.whatsapp.net`

                const file = attachments?.length ? attachments[0] : null;
                if (file) {
                    await bot.providerClass.vendor.presenceSubscribe(jid);
                    await wait(getRandomDelay(700,500));
                    await bot.providerClass.vendor.sendPresenceUpdate("composing", jid);
                    await wait(getRandomDelay(980,800));
                    await bot.providerClass.vendor.sendPresenceUpdate("paused", jid);

                    await bot.providerClass.sendMedia(
                        `${phone}@s.whatsapp.net`,
                        file.data_url,
                        content,
                    );
                    console.log(chalk.green.bold(`<<<<[MENSAJE MULTIMEDIA ENVIADO DESDE CHAT WOOT]`),chalk.cyan(`📋 ${file.data_url}`));
                    res.send('ok')
                    return
                }
        


                /**
                 * esto envia un mensaje de texto al ws
                 */
                await bot.providerClass.vendor.presenceSubscribe(jid);
                await wait(getRandomDelay(750,500));
                await bot.providerClass.vendor.sendPresenceUpdate("composing", jid);
                console.log(chalk.cyan.bold(">>>>Tiempo de escritura"), typingTime(content));
                await wait(typingTime(content));
                await bot.providerClass.vendor.sendPresenceUpdate("paused", jid);
                await bot.providerClass.sendMessage(
                    `${phone}`,
                    content,
                    {}
                );
                console.log(chalk.green.bold(`<<<<[MENSAJE ENVIADO DESDE CHAT WOOT]`),chalk.cyan(`📋 ${content}`));
                //console.log(JSON.stringify(body));
                res.send('ok');
                return;
               
            }

            res.send('ok')
        } catch (error) {
            console.log(chalk.bgRed(`[ERROR ${error.name}]`),chalk.cyan.bold(error.message))
            return res.status(405).send('Error')
        }
    }

    /**
     * Incia tu server http sera encargador de injectar el instanciamiento del bot
     */
    initialization = (bot = undefined) => {
        if(!bot){
            throw new Error('DEBES_DE_PASAR_BOT')
        }
        this.app = express()
        this.app.use(cors())
        this.app.use(express.json())
        this.app.use(express.static('public'))

        this.app.use((req, _, next) => {
            req.bot = bot;
            next()
        })

        this.app.post(`/chatwoot`, this.chatwootCtrl)
        //this.app.get('/scan-qr',this.qrCtrl)

        this.app.listen(this.port, () => {
            console.log(``)
            console.log(`🦮 http://localhost:${this.port}`)
            console.log(``)
        })
    }

}

module.exports = ServerHttp