const Queue = require("queue-promise");
const mimeType = require('mime-types')
const fs = require('node:fs/promises');
const {convertOggMp3}= require('./src/util/convert.util');
class HandlerMessage {
  queue;
  port;
  chatwoot;

  constructor(_port, _chatwoot) {
    this.chatwoot= _chatwoot;
    this.port = _port;
    this.queue = new Queue({
        concurrent: 1,
        interval: 500,
      });
  }

  sendMessageWoot = async (payload) => {
    this.queue.enqueue(async () => {
        try {

            const attachment = []
            /**
             * Determinar si el usuario esta enviando una imagen o video o fichero
             * luego puedes ver los fichero en http://localhost:port/file.pdf o la extension
             */
            if (payload?.body.includes('_event_')) {
                const mime = payload?.message?.imageMessage?.mimetype ?? payload?.message?.videoMessage?.mimetype ?? payload?.message?.documentMessage?.mimetype ?? payload?.message?.audioMessage?.mimetype;
                const extension = mimeType.extension(mime);
                console.log("extension", extension);
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
                console.log(`[FICHERO CREADO] 📋 http://localhost:${this.port}/${fileName}`);
                attachment.push(pathFile.replace('.oga','.mp3'))
            }

            await this.handlerMessage({
                phone: payload.from,
                name: payload.pushName,
                message: payload.body,
                attachment,
                mode: 'incoming'
            }, this.chatwoot)
        } catch (err) {
            console.log('ERROR', err)
        }
    });
  }

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
    await chatwoot.createMessage({
      msg: dataIn.message,
      mode: dataIn.mode,
      conversation_id: conversation.id,
      attachment: dataIn.attachment,
    });
  };
}
