const Queue = require("queue-promise");
const mimeType = require("mime-types");
const fs = require("node:fs/promises");
const { convertOggMp3 } = require("../util/convert.util");
const chalk = require("chalk");
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
/**
 * ESTA CLASE PERMITE ENCOLAR LOS MENSAJES PARA QUE NO SE PIERDAN
 * ASIMISMO MANDA LOS MENSAJES GENERADOS POR EL PROVIDER DE BAILEYS provider.vendor.sendMessage()
 * lo usarias en cada flujo si deseas guardar los mensajes en chatwoot.
 */
class HandlerMessage {
  queue;
  port;
  chatwoot;

  constructor(_port, _chatwoot) {
    this.chatwoot = _chatwoot;
    this.port = _port;
    this.queue = new Queue({
      concurrent: 1,
      interval: 500,
    });
  }

  sendMessageWoot = async (payload, from ,pushName) => {
    this.queue.enqueue(async () => {
      try {
        const attachment = [];
        const body= payload?.message?.extendedTextMessage?.text ?? '';
        const captionFile = payload?.message?.imageMessage?.caption ?? payload?.message?.videoMessage?.caption ?? payload?.message?.documentMessage?.caption ?? payload?.message?.audioMessage?.caption ?? '';
        let extension= '';
        let pathFile= '';
        /**
         * Determinar si el usuario esta enviando una imagen o video o fichero
         * luego puedes ver los fichero en http://localhost:port/file.pdf o la extension
         */
        // 2° opcion !payload?.message.extendedTextMessage.text    payload?.body.includes("_event_") 
        if (!body) {
          const mime =
            payload?.message?.imageMessage?.mimetype ??
            payload?.message?.videoMessage?.mimetype ??
            payload?.message?.documentMessage?.mimetype ??
            payload?.message?.audioMessage?.mimetype;
            extension = mimeType.extension(mime);
        
          const buffer = await downloadMediaMessage(payload, "buffer");
          const fileName = `file-${Date.now()}.${extension}`;
          pathFile = `${process.cwd()}/public/${fileName}`;
          await fs.writeFile(pathFile, buffer);
          if (extension === "oga") {
            // todo convirtiendo audio oga en mp3 y guardandolo
            await convertOggMp3(pathFile, pathFile.replace(".oga", ".mp3"));
            //todo eliminando el archivo oga
            await fs.unlink(pathFile);
          }
          console.log(
            chalk.green.bold(`>>>>[FICHERO ENVIADO DESDE CLIENTE WA CREADO]`),
            chalk.cyan(`📋 http://localhost:${this.port}/${fileName.replace(".oga", ".mp3")}`)
          );
          attachment.push(pathFile.replace(".oga", ".mp3"));
        }
        
        if(['pdf','jpeg','oga','mp3','mp4','docx','xlsx','pptx','txt'].includes(extension)){
          console.log(chalk.green.bold(`>>>>[MENSAJE MULTIMEDIA ENVIADO DESDE BAILEYS WA A CHATWOOT]`), chalk.cyan(`📋 ${pathFile}`));
        }else{
          console.log(chalk.green.bold(`>>>>[MENSAJE ENVIADO DESDE BAILEYS WA A CHATWOOT]`), chalk.cyan(`📋 ${body}`));
        } 

        await this.handlerMessage(
          {
            phone: from,
            name: pushName,
            message: captionFile ? captionFile : body,
            attachment,
            mode: "incoming",
          },
          this.chatwoot
        );
      } catch (err) {
        console.log(chalk.bold.red("ERROR"), err);
      }
    });
  };

  /**
   * Es la funciona que importa para guardar los mensajes y crear lo que sea necesario
   * @param {*} dataIn pasando los datos del contacto + el mensaje
   * @param {*} chatwoot la dependencia del chatwoot...(create, buscar...)
   */
  handlerMessage = async (dataIn = { phone: "", name: "", message: "", mode: "", attachment: [] }, chatwoot) => {
    const inbox = await chatwoot.findOrCreateInbox({ name: "BOTWS" });
    const contact = await chatwoot.findOrCreateContact({ from: dataIn.phone, name: dataIn.name });
    const conversation = await chatwoot.findOrCreateConversation({
      inbox_id: inbox.id,
      contact_id: contact.id,
      phone_number: dataIn.phone,
    });
    //todo permite asignarme un agente humano con estado 'online' a la conversacion (asignacion random)
    await chatwoot.assignAgentConversation({ conversation_id: conversation.id })
   
    await chatwoot.createMessage({
      msg: dataIn.message,
      mode: dataIn.mode,
      conversation_id: conversation.id,
      attachment: dataIn.attachment,
    });
  };
}
module.exports = HandlerMessage;
